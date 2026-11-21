import "server-only";
import { z } from "zod";
import { prisma } from "../db";
import { AppError } from "../errors";
import { notify } from "../notify";
import { isAllowedEndpoint, pushPublicKey } from "../push";
import { assertRole, type Actor } from "./common";

const ALL = ["CONSUMER", "PARENT", "CASHIER", "CHEF", "ADMIN"] as const;

const subscriptionSchema = z.object({
  endpoint: z.string().max(1000).refine(isAllowedEndpoint, "Service de notification non reconnu."),
  keys: z.object({
    p256dh: z.string().min(20).max(200),
    auth: z.string().min(8).max(100),
  }),
});

/** Enregistre l'appareil ; un même navigateur repris par un autre compte change de propriétaire */
export async function subscribePush(actor: Actor, input: unknown, meta: { userAgent?: string | null; locale: "fr" | "en" }) {
  assertRole(actor, [...ALL]);
  if (!pushPublicKey()) throw new AppError("Les notifications push ne sont pas configurées sur ce serveur.", "UNAVAILABLE");
  const { endpoint, keys } = subscriptionSchema.parse(input);
  const userAgent = meta.userAgent?.slice(0, 300) ?? null;
  await prisma.$transaction([
    prisma.pushSubscription.upsert({
      where: { endpoint },
      update: { userId: actor.id, p256dh: keys.p256dh, auth: keys.auth, userAgent },
      create: { userId: actor.id, endpoint, p256dh: keys.p256dh, auth: keys.auth, userAgent },
    }),
    prisma.user.update({ where: { id: actor.id }, data: { locale: meta.locale } }),
  ]);
}

export async function unsubscribePush(actor: Actor, endpoint: string) {
  assertRole(actor, [...ALL]);
  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: actor.id } });
}

export async function pushDevices(actor: Actor) {
  assertRole(actor, [...ALL]);
  return prisma.pushSubscription.count({ where: { userId: actor.id } });
}

/** Notification d'essai, envoyée sur tous les appareils de l'usager */
export async function sendTestPush(actor: Actor) {
  assertRole(actor, [...ALL]);
  if (!(await prisma.pushSubscription.count({ where: { userId: actor.id } }))) {
    throw new AppError("Activez d'abord les notifications sur cet appareil.", "NOT_SUBSCRIBED");
  }
  await notify(prisma, [actor.id], {
    kind: "test",
    title: "Notifications activées",
    body: "Vous serez prévenu ici des repas, rechargements et alertes de solde.",
    href: "/",
  });
}
