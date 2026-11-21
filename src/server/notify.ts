import "server-only";
import type { Tx } from "./db";

export type NotificationKind = "account" | "low_balance" | "meal_served" | "topup" | "family" | "payment_failed" | "test";

export interface NotificationInput {
  kind: NotificationKind;
  title: string;
  body: string;
  /** title et body sont des textes sources (français) interpolés et traduits à l'affichage */
  params?: Record<string, string | number>;
  href?: string;
}

/** Notification in-app (cloche). Écrite dans la même transaction que l'événement qui la déclenche. */
export async function notify(db: Tx, userIds: string[], n: NotificationInput) {
  const ids = [...new Set(userIds)];
  if (!ids.length) return;
  await db.notification.createMany({ data: ids.map((userId) => ({ userId, ...n, params: n.params ?? undefined })) });
}

/** Identifiants des parents associés à un étudiant */
export async function parentIdsOf(db: Tx, childId: string) {
  const links = await db.parentLink.findMany({ where: { childId }, select: { parentId: true } });
  return links.map((l) => l.parentId);
}
