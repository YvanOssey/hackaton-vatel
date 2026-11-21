import "server-only";
import { z } from "zod";
import { prisma, type Tx } from "../db";
import { AppError } from "../errors";
import { audit } from "../audit";
import { type Actor, assertRole } from "./common";

const POS_ROLES = ["CASHIER", "ADMIN"] as const;

export async function currentCashSession(db: Tx, cashierId: string) {
  return db.cashSession.findFirst({ where: { cashierId, status: "OPEN" } });
}

export async function requireOpenSession(db: Tx, cashierId: string) {
  const session = await currentCashSession(db, cashierId);
  if (!session) throw new AppError("Ouvrez votre caisse avant d'encaisser.", "NO_SESSION");
  return session;
}

/** Totaux d'une session : repas débités sur portefeuille et espèces encaissées */
export async function sessionTotals(db: Tx, sessionId: string, openingFloat: number) {
  const groups = await db.transaction.groupBy({
    by: ["type", "method"],
    where: { cashSessionId: sessionId },
    _sum: { amount: true },
    _count: true,
  });
  const pick = (type: string, method: string) => groups.find((g) => g.type === type && g.method === method);
  const meals = pick("MEAL", "WALLET");
  const cash = pick("TOPUP", "CASH");
  const cashIn = cash?._sum.amount ?? 0;
  return {
    mealCount: meals?._count ?? 0,
    mealTotal: Math.abs(meals?._sum.amount ?? 0),
    cashTopupCount: cash?._count ?? 0,
    cashIn,
    expectedCash: openingFloat + cashIn,
  };
}

const amountSchema = z.number({ invalid_type_error: "Montant invalide." }).int("Montant en FCFA entiers.").min(0, "Montant négatif.").max(10_000_000, "Montant trop élevé.");

export async function openCashSession(actor: Actor, openingFloat: number) {
  assertRole(actor, [...POS_ROLES]);
  const float = amountSchema.parse(openingFloat);
  try {
    return await prisma.$transaction(async (tx) => {
      if (await currentCashSession(tx, actor.id)) throw new AppError("Votre caisse est déjà ouverte.", "ALREADY_OPEN");
      const session = await tx.cashSession.create({ data: { cashierId: actor.id, openingFloat: float } });
      await audit(tx, actor.id, "cash.open", { type: "CashSession", id: session.id }, { openingFloat: float });
      return session;
    });
  } catch (e) {
    // Index unique partiel : une seule session ouverte par caissier
    if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2002") throw new AppError("Votre caisse est déjà ouverte.", "ALREADY_OPEN");
    throw e;
  }
}

export async function closeCashSession(actor: Actor, countedCash: number, note?: string) {
  assertRole(actor, [...POS_ROLES]);
  const counted = amountSchema.parse(countedCash);
  const closingNote = z.string().trim().max(500).optional().parse(note) || null;
  return prisma.$transaction(async (tx) => {
    const session = await requireOpenSession(tx, actor.id);
    // Verrou de la session pour éviter un encaissement concurrent pendant la clôture
    await tx.$queryRaw`SELECT id FROM "CashSession" WHERE id = ${session.id} FOR UPDATE`;
    const totals = await sessionTotals(tx, session.id, session.openingFloat);
    const difference = counted - totals.expectedCash;
    if (difference !== 0 && !closingNote) {
      throw new AppError("Un écart de caisse doit être justifié par un commentaire.", "NOTE_REQUIRED");
    }
    const closed = await tx.cashSession.update({
      where: { id: session.id },
      data: { status: "CLOSED", closedAt: new Date(), countedCash: counted, expectedCash: totals.expectedCash, difference, closingNote },
    });
    await audit(tx, actor.id, "cash.close", { type: "CashSession", id: session.id }, { counted, expected: totals.expectedCash, difference });
    return { session: closed, totals };
  });
}
