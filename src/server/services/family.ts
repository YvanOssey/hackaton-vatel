import "server-only";
import { createHash, randomInt } from "node:crypto";
import { z } from "zod";
import { prisma, type Tx } from "../db";
import { AppError } from "../errors";
import { audit } from "../audit";
import { notify } from "../notify";
import { type Actor, assertRole } from "./common";

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_TTL_HOURS = 48;
const MAX_PARENTS = 4;
const MAX_LINK_FAILURES = 5;
const LINK_WINDOW_MIN = 15;

const hashCode = (code: string) => createHash("sha256").update(`link:${code}`).digest("hex");
/** Saisie tolérante : minuscules, espaces et tiret ignorés */
const normalizeCode = (raw: string) => raw.toUpperCase().replace(/[^A-Z0-9]/g, "");

/**
 * L'étudiant génère un code à usage unique (valable 48 h) et le transmet à son parent.
 * Un nouveau code remplace le précédent. Seule son empreinte est stockée.
 */
export async function createLinkCode(actor: Actor) {
  assertRole(actor, ["CONSUMER"]);
  const raw = Array.from({ length: 8 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
  const expiresAt = new Date(Date.now() + CODE_TTL_HOURS * 3_600_000);
  await prisma.$transaction(async (tx) => {
    await tx.linkCode.upsert({
      where: { childId: actor.id },
      update: { codeHash: hashCode(raw), expiresAt, createdAt: new Date() },
      create: { childId: actor.id, codeHash: hashCode(raw), expiresAt },
    });
    await audit(tx, actor.id, "family.code_created", { type: "User", id: actor.id });
  });
  return { code: `${raw.slice(0, 4)}-${raw.slice(4)}`, expiresAt: expiresAt.toISOString() };
}

export async function revokeLinkCode(actor: Actor) {
  assertRole(actor, ["CONSUMER"]);
  await prisma.linkCode.deleteMany({ where: { childId: actor.id } });
}

/** Le parent saisit le code : l'association est créée et le code est consommé */
export async function linkChild(actor: Actor, rawCode: string) {
  assertRole(actor, ["PARENT"]);
  const code = normalizeCode(z.string().max(20).parse(rawCode));
  if (code.length !== 8) throw new AppError("Le code comporte 8 caractères (ex. K7PM-4QX9).", "VALIDATION");
  const key = `link:${actor.id}`;
  const since = new Date(Date.now() - LINK_WINDOW_MIN * 60_000);
  if ((await prisma.loginAttempt.count({ where: { key, success: false, createdAt: { gte: since } } })) >= MAX_LINK_FAILURES) {
    throw new AppError("Trop de codes erronés. Réessayez dans {min} minutes.", "RATE_LIMITED", { min: LINK_WINDOW_MIN });
  }
  const found = await prisma.linkCode.findUnique({ where: { codeHash: hashCode(code) }, include: { child: true } });
  if (!found || found.expiresAt < new Date() || found.child.role !== "CONSUMER" || !["ACTIVE", "PENDING"].includes(found.child.status)) {
    await prisma.loginAttempt.create({ data: { key, success: false, createdAt: new Date() } });
    throw new AppError("Code invalide ou expiré. Demandez à votre enfant d'en générer un nouveau.", "INVALID_CODE");
  }
  const child = found.child;
  return prisma.$transaction(async (tx) => {
    if (await tx.parentLink.findUnique({ where: { parentId_childId: { parentId: actor.id, childId: child.id } } })) {
      throw new AppError("{name} est déjà associé(e) à votre compte.", "DUPLICATE", { name: child.firstName });
    }
    if ((await tx.parentLink.count({ where: { childId: child.id } })) >= MAX_PARENTS) {
      throw new AppError("Un étudiant peut être suivi par {max} comptes parents au maximum.", "LIMIT", { max: MAX_PARENTS });
    }
    await tx.parentLink.create({ data: { parentId: actor.id, childId: child.id } });
    await tx.linkCode.delete({ where: { id: found.id } });
    await notify(tx, [child.id], {
      kind: "family",
      title: "Compte parent associé",
      body: "{name} peut désormais suivre vos repas et recharger votre portefeuille.",
      params: { name: `${actor.firstName} ${actor.lastName}` },
      href: "/espace/profil",
    });
    await audit(tx, actor.id, "family.link", { type: "User", id: child.id });
    return { id: child.id, firstName: child.firstName, lastName: child.lastName };
  });
}

/** Rupture du lien, à l'initiative de l'étudiant ou du parent */
export async function unlink(actor: Actor, otherId: string) {
  assertRole(actor, ["CONSUMER", "PARENT"]);
  const where = actor.role === "PARENT" ? { parentId: actor.id, childId: otherId } : { parentId: otherId, childId: actor.id };
  const { count } = await prisma.parentLink.deleteMany({ where });
  if (!count) throw new AppError("Association introuvable.", "NOT_FOUND");
  await audit(prisma, actor.id, "family.unlink", { type: "User", id: otherId });
}

/** Garde : le parent ne voit que les étudiants qui l'ont associé */
export async function assertGuardian(db: Tx, parentId: string, childId: string) {
  const link = await db.parentLink.findUnique({ where: { parentId_childId: { parentId, childId } } });
  if (!link) throw new AppError("Cet étudiant n'est pas associé à votre compte.", "FORBIDDEN");
}

export async function studentFamily(actor: Actor) {
  assertRole(actor, ["CONSUMER"]);
  const [links, code] = await Promise.all([
    prisma.parentLink.findMany({
      where: { childId: actor.id },
      include: { parent: { select: { id: true, firstName: true, lastName: true, email: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.linkCode.findUnique({ where: { childId: actor.id } }),
  ]);
  return {
    parents: links.map((l) => ({ ...l.parent, since: l.createdAt.toISOString() })),
    activeCodeExpiresAt: code && code.expiresAt > new Date() ? code.expiresAt.toISOString() : null,
  };
}
