import "server-only";
import { z } from "zod";
import { prisma } from "../db";
import { type Actor, assertRole } from "./common";

const ALL = ["CONSUMER", "PARENT", "CASHIER", "CHEF", "ADMIN"] as const;

export async function inbox(actor: Actor) {
  assertRole(actor, [...ALL]);
  const [items, unread] = await Promise.all([
    prisma.notification.findMany({ where: { userId: actor.id }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.notification.count({ where: { userId: actor.id, readAt: null } }),
  ]);
  return {
    unread,
    items: items.map((n) => ({ id: n.id, kind: n.kind, title: n.title, body: n.body, params: (n.params ?? undefined) as Record<string, string | number> | undefined, href: n.href, read: !!n.readAt, createdAt: n.createdAt.toISOString() })),
  };
}

export async function markRead(actor: Actor, ids?: string[]) {
  assertRole(actor, [...ALL]);
  const only = ids ? z.array(z.string().min(1)).max(50).parse(ids) : undefined;
  await prisma.notification.updateMany({ where: { userId: actor.id, readAt: null, ...(only ? { id: { in: only } } : {}) }, data: { readAt: new Date() } });
}
