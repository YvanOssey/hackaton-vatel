import "server-only";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { MOBILE_PROVIDERS, TOPUP_MAX, TOPUP_MIN, normalizeCiPhone } from "@/lib/constants";
import { elides } from "@/lib/utils";
import { prisma } from "../db";
import { AppError } from "../errors";
import { audit } from "../audit";
import { notify, parentIdsOf } from "../notify";
import { paymentGateway } from "../payments/provider";
import { type Actor, assertRole, lockUser } from "./common";
import { assertGuardian } from "./family";

/** Une demande non confirmée expire au bout de 15 minutes */
const INTENT_TTL_MS = 15 * 60_000;
const MAX_PENDING = 3;

const initiateSchema = z.object({
  beneficiaryId: z.string().min(1),
  provider: z.enum(["WAVE", "ORANGE_MONEY"]),
  phone: z.string().max(20),
  amount: z
    .number({ invalid_type_error: "Montant invalide." })
    .int("Montant en FCFA entiers.")
    .min(TOPUP_MIN, "Montant minimum : 500 FCFA.")
    .max(TOPUP_MAX, "Montant maximum : 200 000 FCFA."),
});

/** Étape 1 : la demande de paiement est envoyée sur le téléphone du payeur */
export async function initiateTopUp(actor: Actor, raw: z.infer<typeof initiateSchema>) {
  assertRole(actor, ["CONSUMER", "PARENT"]);
  const input = initiateSchema.parse(raw);
  const phone = normalizeCiPhone(input.phone);
  if (!phone) throw new AppError("Numéro Mobile Money invalide (10 chiffres, ex. 07 08 09 10 11).", "VALIDATION");

  if (actor.role === "CONSUMER" && input.beneficiaryId !== actor.id) throw new AppError("Vous ne pouvez recharger que votre propre portefeuille.", "FORBIDDEN");
  if (actor.role === "PARENT") await assertGuardian(prisma, actor.id, input.beneficiaryId);
  const beneficiary = await prisma.user.findUnique({ where: { id: input.beneficiaryId } });
  if (!beneficiary || beneficiary.role !== "CONSUMER" || !["ACTIVE", "PENDING"].includes(beneficiary.status)) {
    throw new AppError("Ce portefeuille ne peut pas être rechargé.", "FORBIDDEN");
  }

  await expireStale(actor.id);
  if ((await prisma.paymentIntent.count({ where: { payerId: actor.id, status: "PENDING" } })) >= MAX_PENDING) {
    throw new AppError("Trop de paiements en attente : confirmez ou laissez expirer les précédents.", "LIMIT");
  }
  const reference = `CC-${randomBytes(5).toString("hex").toUpperCase()}`;
  const gateway = paymentGateway();
  await gateway.initiate({ reference, provider: input.provider, phone, amount: input.amount });
  const intent = await prisma.paymentIntent.create({
    data: { reference, userId: beneficiary.id, payerId: actor.id, provider: input.provider, phone, amount: input.amount, createdAt: new Date() },
  });
  return { id: intent.id, reference, amount: intent.amount, provider: intent.provider, phone, sandbox: gateway.mode === "sandbox" };
}

async function expireStale(payerId: string) {
  await prisma.paymentIntent.updateMany({
    where: { payerId, status: "PENDING", createdAt: { lt: new Date(Date.now() - INTENT_TTL_MS) } },
    data: { status: "EXPIRED", completedAt: new Date() },
  });
}

/**
 * Étape 2 : vérification auprès de l'opérateur. Le crédit est idempotent :
 * la demande passe de PENDING à SUCCEEDED dans la même transaction que l'écriture du grand livre.
 */
export async function confirmTopUp(actor: Actor, intentId: string) {
  assertRole(actor, ["CONSUMER", "PARENT"]);
  const intent = await prisma.paymentIntent.findUnique({ where: { id: z.string().min(1).parse(intentId) } });
  if (!intent || intent.payerId !== actor.id) throw new AppError("Paiement introuvable.", "NOT_FOUND");
  if (intent.status !== "PENDING") return { status: intent.status, balance: null, reason: intent.failureReason };
  if (intent.createdAt.getTime() < Date.now() - INTENT_TTL_MS) {
    await expireStale(actor.id);
    return { status: "EXPIRED" as const, balance: null, reason: "Délai de confirmation dépassé." };
  }

  const result = await paymentGateway().check({ reference: intent.reference, phone: intent.phone });
  if (result.status === "PENDING") return { status: "PENDING" as const, balance: null, reason: null };
  if (result.status === "FAILED") {
    await prisma.paymentIntent.updateMany({ where: { id: intent.id, status: "PENDING" }, data: { status: "FAILED", failureReason: result.reason, completedAt: new Date() } });
    return { status: "FAILED" as const, balance: null, reason: result.reason };
  }

  const provider = MOBILE_PROVIDERS[intent.provider].label;
  return prisma.$transaction(async (tx) => {
    const claimed = await tx.paymentIntent.updateMany({ where: { id: intent.id, status: "PENDING" }, data: { status: "SUCCEEDED", completedAt: new Date() } });
    if (!claimed.count) return { status: "SUCCEEDED" as const, balance: null, reason: null };
    const user = await lockUser(tx, intent.userId);
    const balance = user.balance + intent.amount;
    await tx.user.update({ where: { id: user.id }, data: { balance } });
    const byParent = intent.payerId !== intent.userId;
    const t = await tx.transaction.create({
      data: {
        userId: user.id,
        type: "TOPUP",
        method: "MOBILE_MONEY",
        amount: intent.amount,
        balanceAfter: balance,
        label: `Rechargement ${provider}`,
        note: byParent ? `Payé par ${actor.firstName} ${actor.lastName} · Réf. ${intent.reference}` : `Réf. ${intent.reference}`,
        operatorId: actor.id,
      },
    });
    await tx.paymentIntent.update({ where: { id: intent.id }, data: { transactionId: t.id } });
    if (byParent) {
      await notify(tx, [user.id], {
        kind: "topup",
        title: "Portefeuille rechargé",
        body: "{name} a ajouté {amount:money} à votre portefeuille.",
        params: { name: actor.firstName, amount: intent.amount },
        href: "/espace/portefeuille",
      });
    } else {
      await notify(tx, [user.id], {
        kind: "topup",
        title: "Portefeuille crédité",
        body: "{amount:money} via {provider}. Nouveau solde : {balance:money}.",
        params: { amount: intent.amount, provider, balance },
        href: "/espace/portefeuille",
      });
    }
    const others = (await parentIdsOf(tx, user.id)).filter((id) => id !== actor.id);
    await notify(tx, others, {
      kind: "topup",
      title: elides(user.firstName) ? "Portefeuille d'{child} rechargé" : "Portefeuille de {child} rechargé",
      body: "{amount:money} via {provider}. Nouveau solde : {balance:money}.",
      params: { child: user.firstName, amount: intent.amount, provider, balance },
      href: "/famille",
    });
    await audit(tx, actor.id, "wallet.online_topup", { type: "User", id: user.id }, { amount: intent.amount, provider: intent.provider, reference: intent.reference });
    return { status: "SUCCEEDED" as const, balance, reason: null };
  });
}

export async function recentPayments(actor: Actor) {
  assertRole(actor, ["CONSUMER", "PARENT"]);
  await expireStale(actor.id);
  return prisma.paymentIntent.findMany({
    where: { payerId: actor.id },
    include: { user: { select: { firstName: true } } },
    orderBy: { createdAt: "desc" },
    take: 8,
  });
}
