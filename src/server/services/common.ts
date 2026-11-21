import "server-only";
import type { Role, User } from "@prisma/client";
import { AppError } from "../errors";
import type { Tx } from "../db";

export type Actor = Pick<User, "id" | "role" | "status" | "firstName" | "lastName" | "email">;

export function assertRole(actor: Actor | null | undefined, roles: Role[]): asserts actor is Actor {
  if (!actor) throw new AppError("Session expirée, reconnectez-vous.", "UNAUTHENTICATED");
  if (actor.status !== "ACTIVE" && !(actor.role === "CONSUMER" && actor.status === "PENDING")) {
    throw new AppError("Votre compte n'est pas actif.", "FORBIDDEN");
  }
  if (!roles.includes(actor.role)) throw new AppError("Vous n'avez pas accès à cette action.", "FORBIDDEN");
}

/** Verrouille la ligne de l'usager jusqu'à la fin de la transaction (évite les doubles débits concurrents) */
export async function lockUser(tx: Tx, userId: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
  if (!rows.length) throw new AppError("Usager introuvable.", "NOT_FOUND");
  return tx.user.findUniqueOrThrow({ where: { id: userId } });
}

export function getSettings(db: Tx) {
  return db.settings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
}

/** Somme des réservations à venir non servies (montant engagé sur le solde) */
export async function committedAmount(db: Tx, userId: string, today: string) {
  const agg = await db.reservation.aggregate({
    where: { userId, status: "RESERVED", date: { gte: new Date(`${today}T00:00:00Z`) } },
    _sum: { price: true },
  });
  return agg._sum.price ?? 0;
}
