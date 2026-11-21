import "server-only";
import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import type { Role } from "@prisma/client";
import { isTime } from "@/lib/rules";
import { prisma } from "../db";
import { AppError } from "../errors";
import { audit } from "../audit";
import { notify } from "../notify";
import { type Actor, assertRole, getSettings, lockUser } from "./common";

const ADMIN = ["ADMIN"] as const;
const noteSchema = z.string().trim().max(300).optional();

export function temporaryPassword() {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const body = Array.from({ length: 10 }, () => alphabet[randomInt(alphabet.length)]).join("");
  return `${body}!${randomInt(10, 99)}`;
}

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 11);
}

async function targetUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError("Compte introuvable.", "NOT_FOUND");
  return user;
}

export async function approveUser(actor: Actor, userId: string, note?: string) {
  assertRole(actor, [...ADMIN]);
  const user = await targetUser(userId);
  if (user.role !== "CONSUMER") throw new AppError("Seuls les comptes usagers sont validés ici.");
  if (user.status !== "PENDING") throw new AppError("Ce compte n'est pas en attente de validation.");
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { status: "ACTIVE", tariffGroup: "STUDENT", reviewedAt: new Date(), reviewedById: actor.id, reviewNote: noteSchema.parse(note) || null },
    });
    await notify(tx, [userId], {
      kind: "account",
      title: "Compte validé",
      body: "Votre numéro étudiant a été vérifié : vous pouvez réserver vos repas et utiliser votre pass.",
      href: "/espace",
    });
    await audit(tx, actor.id, "user.approve", { type: "User", id: userId }, { memberRef: user.memberRef });
  });
}

export async function rejectUser(actor: Actor, userId: string, note: string) {
  assertRole(actor, [...ADMIN]);
  const reason = z.string().trim().min(3, "Indiquez le motif du refus.").max(300).parse(note);
  const user = await targetUser(userId);
  if (user.status !== "PENDING") throw new AppError("Ce compte n'est pas en attente de validation.");
  if (user.balance > 0) throw new AppError("Ce compte a un solde : remboursez-le avant de refuser l'inscription.");
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { status: "REJECTED", reviewedAt: new Date(), reviewedById: actor.id, reviewNote: reason } });
    await tx.session.deleteMany({ where: { userId } });
    await audit(tx, actor.id, "user.reject", { type: "User", id: userId }, { reason });
  });
}

export async function setSuspended(actor: Actor, userId: string, suspended: boolean) {
  assertRole(actor, [...ADMIN]);
  if (userId === actor.id) throw new AppError("Vous ne pouvez pas suspendre votre propre compte.");
  const user = await targetUser(userId);
  if (suspended && user.status !== "ACTIVE") throw new AppError("Seul un compte actif peut être suspendu.");
  if (!suspended && user.status !== "SUSPENDED") throw new AppError("Ce compte n'est pas suspendu.");
  if (suspended && user.role === "ADMIN" && (await prisma.user.count({ where: { role: "ADMIN", status: "ACTIVE" } })) <= 1) {
    throw new AppError("Impossible de suspendre le dernier administrateur actif.");
  }
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { status: suspended ? "SUSPENDED" : "ACTIVE" } });
    if (suspended) await tx.session.deleteMany({ where: { userId } });
    await audit(tx, actor.id, suspended ? "user.suspend" : "user.reactivate", { type: "User", id: userId });
  });
}

const staffSchema = z.object({
  email: z.string().trim().toLowerCase().email("Adresse e-mail invalide.").max(120),
  firstName: z.string().trim().min(1, "Prénom requis.").max(60),
  lastName: z.string().trim().min(1, "Nom requis.").max(60),
  role: z.enum(["CASHIER", "CHEF", "ADMIN"]),
});

/** Crée un compte du personnel ; le mot de passe provisoire n'est affiché qu'une fois */
export async function createStaff(actor: Actor, raw: { email: string; firstName: string; lastName: string; role: Role }) {
  assertRole(actor, [...ADMIN]);
  const input = staffSchema.parse(raw);
  if (await prisma.user.findUnique({ where: { email: input.email } })) throw new AppError("Un compte existe déjà avec cette adresse.", "DUPLICATE");
  const password = temporaryPassword();
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: { ...input, passwordHash: await hashPassword(password), status: "ACTIVE", mustChangePassword: true, tariffGroup: "STAFF" },
    });
    await audit(tx, actor.id, "user.create_staff", { type: "User", id: created.id }, { role: input.role, email: input.email });
    return created;
  });
  return { user, password };
}

export async function resetPassword(actor: Actor, userId: string) {
  assertRole(actor, [...ADMIN]);
  await targetUser(userId);
  const password = temporaryPassword();
  const hash = await hashPassword(password);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { passwordHash: hash, mustChangePassword: true } });
    await tx.session.deleteMany({ where: { userId } });
    await audit(tx, actor.id, "user.reset_password", { type: "User", id: userId });
  });
  return { password };
}

/** Crédit ou correction manuelle du portefeuille, motif obligatoire */
export async function adjustBalance(actor: Actor, userId: string, amount: number, reason: string) {
  assertRole(actor, [...ADMIN]);
  const value = z.number().int("Montant en FCFA entiers.").min(-1_000_000).max(1_000_000).refine((n) => n !== 0, "Montant nul.").parse(amount);
  const why = z.string().trim().min(5, "Motif obligatoire (5 caractères minimum).").max(300).parse(reason);
  return prisma.$transaction(async (tx) => {
    const user = await lockUser(tx, userId);
    if (user.role !== "CONSUMER") throw new AppError("Seuls les portefeuilles d'usagers peuvent être ajustés.");
    const balance = user.balance + value;
    if (balance < 0) throw new AppError("Le solde ne peut pas devenir négatif (solde actuel {balance:money}).", "BUSINESS", { balance: user.balance });
    await tx.user.update({ where: { id: userId }, data: { balance } });
    await tx.transaction.create({
      data: {
        userId,
        type: "ADJUSTMENT",
        method: "ADMIN",
        amount: value,
        balanceAfter: balance,
        label: value > 0 ? "Crédit administratif" : "Correction administrative",
        note: why,
        operatorId: actor.id,
      },
    });
    if (value > 0) {
      await notify(tx, [userId], {
        kind: "topup",
        title: "Portefeuille crédité",
        body: "{amount:money} ajoutés par l'administration ({reason}). Nouveau solde : {balance:money}.",
        params: { amount: value, reason: why, balance },
        href: "/espace/portefeuille",
      });
    }
    await audit(tx, actor.id, "wallet.adjust", { type: "User", id: userId }, { amount: value, reason: why });
    return { balance };
  });
}

export const settingsSchema = z.object({
  establishmentName: z.string().trim().min(2).max(80),
  cutoffTime: z.string().refine(isTime, "Heure limite invalide (HH:MM)."),
  bookingHorizonDays: z.number().int().min(1, "Horizon minimum : 1 jour.").max(60),
  lowBalanceThreshold: z.number().int().min(0).max(1_000_000),
  allowWalkIn: z.boolean(),
  priceStudent: z.number().int().min(0, "Prix invalide.").max(100_000, "Prix trop élevé."),
  serviceStart: z.string().refine(isTime, "Heure de début du service invalide (HH:MM)."),
  serviceEnd: z.string().refine(isTime, "Heure de fin du service invalide (HH:MM)."),
  pickupCapacity: z.number().int().min(1, "Au moins 1 repas à emporter par créneau.").max(500),
}).refine((s) => s.serviceStart < s.serviceEnd, { message: "Le service doit finir après son début.", path: ["serviceEnd"] });

export async function updateSettings(actor: Actor, raw: z.infer<typeof settingsSchema>) {
  assertRole(actor, [...ADMIN]);
  const data = settingsSchema.parse(raw);
  return prisma.$transaction(async (tx) => {
    const before = await getSettings(tx);
    const after = await tx.settings.update({ where: { id: 1 }, data });
    await audit(tx, actor.id, "settings.update", { type: "Settings", id: "1" }, {
      before: { ...before, updatedAt: undefined },
      after: { ...after, updatedAt: undefined },
    } as never);
    return after;
  });
}
