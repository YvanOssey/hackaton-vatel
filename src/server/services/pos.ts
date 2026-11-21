import "server-only";
import { normalizeScan } from "@/lib/pass-scan";
import { z } from "zod";
import { TOPUP_MAX, TOPUP_MIN } from "@/lib/constants";
import { allergenConflicts, mealPrice } from "@/lib/rules";
import { elides, isoToDate } from "@/lib/utils";
import { prisma, type Tx } from "../db";
import { AppError } from "../errors";
import { notify, parentIdsOf } from "../notify";
import { verifyPassToken } from "../pass";
import { clock } from "../time";
import { requireOpenSession } from "./cash";
import { type Actor, assertRole, getSettings, lockUser } from "./common";

const POS_ROLES = ["CASHIER", "ADMIN"] as const;

export type CustomerSnapshot = Awaited<ReturnType<typeof customerSnapshot>>;

/** Fiche affichée en caisse : solde, réservation du jour, alertes allergènes */
export async function customerSnapshot(db: Tx, userId: string) {
  const today = clock().today;
  const [user, settings, menu] = await Promise.all([
    db.user.findUnique({ where: { id: userId } }),
    getSettings(db),
    db.menu.findUnique({ where: { date: isoToDate(today) }, include: { dishes: true } }),
  ]);
  if (!user || user.role !== "CONSUMER") throw new AppError("Ce pass ne correspond à aucun usager.", "NOT_FOUND");
  const reservation = await db.reservation.findUnique({ where: { userId_date: { userId, date: isoToDate(today) } } });
  const published = menu?.status === "PUBLISHED" ? menu : null;
  const conflicts = published ? allergenConflicts(user.allergens, published.dishes.map((d) => d.allergens)) : [];
  const activeReservation = reservation && reservation.status !== "CANCELLED" ? reservation : null;
  const price = activeReservation?.status === "RESERVED" ? activeReservation.price : mealPrice(settings);
  return {
    user: {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      status: user.status,
      memberRef: user.memberRef,
      balance: user.balance,
      allergens: user.allergens,
    },
    reservation: activeReservation
      ? { status: activeReservation.status, price: activeReservation.price, servedAt: activeReservation.servedAt?.toISOString() ?? null, pickupSlot: activeReservation.pickupSlot }
      : null,
    price,
    conflicts,
    conflictDishes: published ? published.dishes.filter((d) => d.allergens.some((a) => conflicts.includes(a))).map((d) => d.name) : [],
    hasMenu: !!published,
    allowWalkIn: settings.allowWalkIn,
    lowBalanceThreshold: settings.lowBalanceThreshold,
  };
}

export async function lookupByPass(actor: Actor, scanned: string) {
  assertRole(actor, [...POS_ROLES]);
  const parsed = verifyPassToken(normalizeScan(scanned));
  if (!parsed) throw new AppError("QR Code invalide ou falsifié.", "INVALID_PASS");
  const user = await prisma.user.findUnique({ where: { id: parsed.userId }, select: { passVersion: true } });
  if (!user) throw new AppError("Ce pass ne correspond à aucun usager.", "NOT_FOUND");
  if (user.passVersion !== parsed.version) throw new AppError("Ce pass a été révoqué. L'usager doit afficher son nouveau QR Code.", "REVOKED_PASS");
  return customerSnapshot(prisma, parsed.userId);
}

export async function searchConsumers(actor: Actor, query: string) {
  assertRole(actor, [...POS_ROLES]);
  const q = z.string().trim().min(2, "Saisissez au moins 2 caractères.").max(60).parse(query);
  const terms = q.split(/\s+/).slice(0, 3);
  return prisma.user.findMany({
    where: {
      role: "CONSUMER",
      status: { in: ["ACTIVE", "PENDING"] },
      AND: terms.map((t) => ({
        OR: [
          { firstName: { contains: t, mode: "insensitive" as const } },
          { lastName: { contains: t, mode: "insensitive" as const } },
          { memberRef: { contains: t, mode: "insensitive" as const } },
          { email: { contains: t, mode: "insensitive" as const } },
        ],
      })),
    },
    select: { id: true, firstName: true, lastName: true, memberRef: true, status: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: 8,
  });
}

export async function getCustomer(actor: Actor, userId: string) {
  assertRole(actor, [...POS_ROLES]);
  return customerSnapshot(prisma, z.string().min(1).parse(userId));
}

export async function serveMeal(actor: Actor, userId: string, allergenAck: boolean) {
  assertRole(actor, [...POS_ROLES]);
  const result = await prisma.$transaction(async (tx) => {
    const session = await requireOpenSession(tx, actor.id);
    const user = await lockUser(tx, userId);
    if (user.role !== "CONSUMER") throw new AppError("Ce compte ne peut pas être servi.", "FORBIDDEN");
    if (user.status !== "ACTIVE") throw new AppError("Compte non validé ou suspendu : repas impossible.", "INACTIVE");

    const today = clock().today;
    const settings = await getSettings(tx);
    const menu = await tx.menu.findUnique({ where: { date: isoToDate(today) }, include: { dishes: true } });
    if (!menu || menu.status !== "PUBLISHED") throw new AppError("Aucun menu publié aujourd'hui.", "NO_MENU");

    const reservation = await tx.reservation.findUnique({ where: { userId_date: { userId, date: isoToDate(today) } } });
    if (reservation?.status === "SERVED") throw new AppError("Repas déjà servi aujourd'hui.", "ALREADY_SERVED");
    const reserved = reservation?.status === "RESERVED";
    if (!reserved && !settings.allowWalkIn) throw new AppError("Repas sans réservation non autorisé.", "WALK_IN_DISABLED");

    const conflicts = allergenConflicts(user.allergens, menu.dishes.map((d) => d.allergens));
    if (conflicts.length && !allergenAck) throw new AppError("Alerte allergène : confirmez la remise d'un plateau adapté.", "ALLERGEN_ACK_REQUIRED");

    const price = reserved ? reservation!.price : mealPrice(settings);
    if (user.balance < price) throw new AppError("Solde insuffisant ({balance:money}).", "INSUFFICIENT", { balance: user.balance });

    const balance = user.balance - price;
    await tx.user.update({ where: { id: user.id }, data: { balance } });
    const now = new Date();
    const data = { status: "SERVED" as const, servedAt: now, servedById: actor.id, allergenOverride: conflicts.length > 0, price, walkIn: !reserved };
    const res = reservation
      ? await tx.reservation.update({ where: { id: reservation.id }, data })
      : await tx.reservation.create({ data: { ...data, userId: user.id, date: isoToDate(today) } });
    await tx.transaction.create({
      data: {
        userId: user.id,
        type: "MEAL",
        method: "WALLET",
        amount: -price,
        balanceAfter: balance,
        label: reserved ? "Repas du midi" : "Repas du midi (sans réservation)",
        note: conflicts.length ? `Alerte allergène vérifiée : ${conflicts.join(", ")}` : null,
        reservationId: res.id,
        cashSessionId: session.id,
        operatorId: actor.id,
      },
    });
    await tx.$executeRaw`UPDATE "StockItem" SET qty = GREATEST(qty - "perMeal", 0), "updatedAt" = now() WHERE "perMeal" > 0`;

    // Suivi parental : ce que l'enfant a mangé, et alerte quand le solde passe sous le seuil
    const parents = await parentIdsOf(tx, user.id);
    const main = menu.dishes.find((d) => d.course === "MAIN")?.name;
    await notify(tx, parents, {
      kind: "meal_served",
      title: "{child} a déjeuné",
      body: main ? "{dish} · {price:money} débités. Solde : {balance:money}." : "{price:money} débités. Solde : {balance:money}.",
      params: { child: user.firstName, dish: main ?? "", price, balance },
      href: "/famille",
    });
    if (balance < settings.lowBalanceThreshold && user.balance >= settings.lowBalanceThreshold) {
      await notify(tx, [user.id], { kind: "low_balance", title: "Solde bas", body: "Il vous reste {balance:money}. Pensez à recharger.", params: { balance }, href: "/espace/portefeuille" });
      await notify(tx, parents, { kind: "low_balance", title: "Solde bas pour {child}", body: "Il reste {balance:money} sur son portefeuille.", params: { child: user.firstName, balance }, href: "/famille" });
    }
    return { price, balance };
  });
  return { ...result, snapshot: await customerSnapshot(prisma, userId) };
}

const topupSchema = z
  .number({ invalid_type_error: "Montant invalide." })
  .int("Montant en FCFA entiers.")
  .min(TOPUP_MIN, "Montant minimum : 500 FCFA.")
  .max(TOPUP_MAX, "Montant maximum : 200 000 FCFA.");

export async function cashTopUp(actor: Actor, userId: string, amount: number) {
  assertRole(actor, [...POS_ROLES]);
  const value = topupSchema.parse(amount);
  await prisma.$transaction(async (tx) => {
    const session = await requireOpenSession(tx, actor.id);
    const user = await lockUser(tx, userId);
    if (user.role !== "CONSUMER" || (user.status !== "ACTIVE" && user.status !== "PENDING")) {
      throw new AppError("Rechargement impossible sur ce compte.", "FORBIDDEN");
    }
    const balance = user.balance + value;
    await tx.user.update({ where: { id: user.id }, data: { balance } });
    await tx.transaction.create({
      data: {
        userId: user.id,
        type: "TOPUP",
        method: "CASH",
        amount: value,
        balanceAfter: balance,
        label: "Rechargement au comptoir",
        cashSessionId: session.id,
        operatorId: actor.id,
      },
    });
    await notify(tx, [user.id], {
      kind: "topup",
      title: "Portefeuille crédité",
      body: "{amount:money} ajoutés en espèces au comptoir. Nouveau solde : {balance:money}.",
      params: { amount: value, balance },
      href: "/espace/portefeuille",
    });
    await notify(tx, await parentIdsOf(tx, user.id), {
      kind: "topup",
      title: elides(user.firstName) ? "Portefeuille d'{child} rechargé" : "Portefeuille de {child} rechargé",
      body: "{amount:money} en espèces au comptoir. Nouveau solde : {balance:money}.",
      params: { child: user.firstName, amount: value, balance },
      href: "/famille",
    });
  });
  return customerSnapshot(prisma, userId);
}
