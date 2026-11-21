import "server-only";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { ALLERGEN_IDS } from "@/lib/constants";
import { prisma } from "../db";
import { AppError } from "../errors";
import { audit } from "../audit";
import { hashPassword } from "./admin";
import { type Actor, assertRole } from "./common";

const MAX_FAILURES = 5;
const WINDOW_MIN = 15;
// Empreinte factice : le temps de réponse est le même que l'e-mail existe ou non
let dummyHash: Promise<string> | null = null;
const getDummyHash = () => (dummyHash ??= bcrypt.hash("compte-inexistant", 11));

export const passwordSchema = z
  .string()
  .min(10, "Mot de passe : 10 caractères minimum.")
  .max(128, "Mot de passe trop long.")
  .refine((p) => /[a-zA-Z]/.test(p) && /\d/.test(p), "Le mot de passe doit contenir des lettres et des chiffres.");

export const registerSchema = z.object({
  accountType: z.enum(["STUDENT", "PARENT"]).default("STUDENT"),
  firstName: z.string().trim().min(1, "Prénom requis.").max(60),
  lastName: z.string().trim().min(1, "Nom requis.").max(60),
  email: z.string().trim().toLowerCase().email("Adresse e-mail invalide.").max(120),
  phone: z.string().trim().max(30).optional(),
  memberRef: z.string().trim().max(40, "Numéro étudiant trop long.").optional(),
  allergens: z.array(z.enum(ALLERGEN_IDS as [string, ...string[]])).max(14).default([]),
  password: passwordSchema,
});

export type RegisterInput = z.input<typeof registerSchema>;

export async function register(raw: RegisterInput) {
  const input = registerSchema.parse(raw);
  if (await prisma.user.findUnique({ where: { email: input.email } })) {
    throw new AppError("Un compte existe déjà avec cette adresse e-mail.", "DUPLICATE");
  }
  if (input.accountType === "PARENT") {
    // Compte parent : actif immédiatement, il ne voit un étudiant qu'avec le code fourni par celui-ci
    const user = await prisma.user.create({
      data: {
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone || null,
        passwordHash: await hashPassword(input.password),
        role: "PARENT",
        status: "ACTIVE",
      },
    });
    await audit(prisma, user.id, "user.register_parent", { type: "User", id: user.id });
    return user;
  }
  if (!input.memberRef || input.memberRef.length < 3) throw new AppError("Indiquez votre numéro étudiant.", "VALIDATION");
  if (await prisma.user.findFirst({ where: { memberRef: { equals: input.memberRef, mode: "insensitive" }, role: "CONSUMER", status: { not: "REJECTED" } } })) {
    throw new AppError("Ce numéro étudiant est déjà associé à un compte. Contactez l'administration.", "DUPLICATE");
  }
  const { password, accountType: _type, ...rest } = input;
  void _type;
  const user = await prisma.user.create({
    data: {
      ...rest,
      phone: rest.phone || null,
      memberRef: rest.memberRef,
      passwordHash: await hashPassword(password),
      role: "CONSUMER",
      status: "PENDING",
      // Établissement réservé aux étudiants ; le numéro est vérifié par l'administration
      tariffGroup: "STUDENT",
      requestedGroup: "STUDENT",
    },
  });
  await audit(prisma, user.id, "user.register", { type: "User", id: user.id }, { memberRef: input.memberRef });
  return user;
}

export async function authenticate(emailRaw: string, password: string) {
  const email = z.string().trim().toLowerCase().max(120).parse(emailRaw);
  const since = new Date(Date.now() - WINDOW_MIN * 60_000);
  const failures = await prisma.loginAttempt.count({ where: { key: email, success: false, createdAt: { gte: since } } });
  if (failures >= MAX_FAILURES) {
    throw new AppError("Trop de tentatives. Réessayez dans {min} minutes.", "RATE_LIMITED", { min: WINDOW_MIN });
  }
  const user = await prisma.user.findUnique({ where: { email } });
  const valid = await bcrypt.compare(password.slice(0, 128), user?.passwordHash ?? (await getDummyHash()));
  await prisma.loginAttempt.create({ data: { key: email, success: !!(user && valid), createdAt: new Date() } });
  if (!user || !valid) throw new AppError("E-mail ou mot de passe incorrect.", "INVALID_CREDENTIALS");
  if (user.status === "REJECTED") throw (user.reviewNote ? new AppError("Inscription refusée : {note}", "REJECTED", { note: user.reviewNote }) : new AppError("Inscription refusée.", "REJECTED"));
  if (user.status === "SUSPENDED") throw new AppError("Compte suspendu. Contactez l'administration.", "SUSPENDED");
  await prisma.loginAttempt.deleteMany({ where: { key: email, success: false } });
  return user;
}

export async function changePassword(actor: Actor, current: string, next: string) {
  assertRole(actor, ["CONSUMER", "PARENT", "CASHIER", "CHEF", "ADMIN"]);
  const pw = passwordSchema.parse(next);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: actor.id } });
  if (!(await bcrypt.compare(current.slice(0, 128), user.passwordHash))) throw new AppError("Mot de passe actuel incorrect.", "INVALID_CREDENTIALS");
  if (current === pw) throw new AppError("Choisissez un mot de passe différent de l'actuel.");
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: actor.id }, data: { passwordHash: await hashPassword(pw), mustChangePassword: false } });
    await audit(tx, actor.id, "user.change_password", { type: "User", id: actor.id });
  });
}

const profileSchema = z.object({
  phone: z.string().trim().max(30).optional(),
  allergens: z.array(z.enum(ALLERGEN_IDS as [string, ...string[]])).max(14),
});

export async function updateProfile(actor: Actor, raw: z.infer<typeof profileSchema>) {
  assertRole(actor, ["CONSUMER"]);
  const input = profileSchema.parse(raw);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: actor.id }, data: { phone: input.phone || null, allergens: input.allergens } });
    await audit(tx, actor.id, "user.update_allergens", { type: "User", id: actor.id }, { allergens: input.allergens });
  });
}

/** Révoque le QR Code actuel (perte, capture partagée) et en génère un nouveau */
export async function regeneratePass(actor: Actor) {
  assertRole(actor, ["CONSUMER"]);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: actor.id }, data: { passVersion: { increment: 1 } } });
    await audit(tx, actor.id, "pass.regenerate", { type: "User", id: actor.id });
  });
}
