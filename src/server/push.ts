import "server-only";
import webpush from "web-push";
import { isLocale } from "@/i18n/config";
import { translate, type Params } from "@/i18n/core";
import { prisma } from "./db";

/**
 * Notifications push (Web Push, clés VAPID).
 *
 * Boîte d'envoi : `notify()` écrit la notification dans la transaction métier ; l'envoi push a lieu
 * après la réponse (flushPush), hors transaction. Chaque notification est « réservée » par une mise à jour
 * conditionnelle (pushedAt null → maintenant) : elle n'est jamais envoyée deux fois, même avec plusieurs serveurs.
 */

export type PushTarget = { endpoint: string; p256dh: string; auth: string };
export type PushResult = "ok" | "gone" | "error";
export interface PushSender {
  send(target: PushTarget, payload: string): Promise<PushResult>;
}

/** Au-delà, une notification non envoyée n'a plus d'intérêt en push (elle reste dans la cloche) */
const STALE_MS = 60 * 60 * 1000;

/** Services de push des navigateurs : seuls ces hôtes sont acceptés (pas de requêtes vers des adresses arbitraires) */
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/, /^web\.push\.apple\.com$/, /\.push\.apple\.com$/, /\.notify\.windows\.com$/];

export function isAllowedEndpoint(endpoint: string) {
  try {
    const u = new URL(endpoint);
    return u.protocol === "https:" && PUSH_HOSTS.some((re) => re.test(u.hostname));
  } catch {
    return false;
  }
}

/** Variable d'environnement sans espaces ni guillemets parasites */
const clean = (v?: string) => v?.trim().replace(/^["']|["']$/g, "") || undefined;

const vapid = () => {
  const publicKey = clean(process.env.VAPID_PUBLIC_KEY);
  const privateKey = clean(process.env.VAPID_PRIVATE_KEY);
  return publicKey && privateKey ? { publicKey, privateKey, subject: clean(process.env.VAPID_SUBJECT) || "mailto:contact@example.com" } : null;
};

/** Clé publique transmise au navigateur pour s'abonner ; null si le push n'est pas configuré */
export const pushPublicKey = () => vapid()?.publicKey ?? null;

const webPushSender: PushSender = {
  async send(target, payload) {
    const keys = vapid();
    if (!keys) return "error";
    try {
      await webpush.sendNotification({ endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } }, payload, {
        vapidDetails: { subject: keys.subject, publicKey: keys.publicKey, privateKey: keys.privateKey },
        TTL: 60 * 60,
        urgency: "high",
        timeout: 8000,
      });
      return "ok";
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      // 404 / 410 : l'abonnement n'existe plus (désinstallation, permission retirée)
      if (status === 404 || status === 410) return "gone";
      console.error("[push]", status ?? e);
      return "error";
    }
  },
};

let sender: PushSender | null = null;
/** Tests : remplace l'envoi réel */
export function setPushSender(s: PushSender | null) {
  sender = s;
}
const activeSender = () => sender ?? (vapid() ? webPushSender : null);

/** Envoie les notifications en attente ; renvoie le nombre de messages remis */
export async function flushPush(limit = 50) {
  const send = activeSender();
  if (!send) return 0;
  const now = new Date();
  // Trop anciennes : marquées comme traitées sans envoi
  await prisma.notification.updateMany({ where: { pushedAt: null, createdAt: { lt: new Date(now.getTime() - STALE_MS) } }, data: { pushedAt: now } });

  const pending = await prisma.notification.findMany({
    where: { pushedAt: null },
    orderBy: { createdAt: "asc" },
    take: limit,
    include: { user: { select: { locale: true, pushSubscriptions: true } } },
  });
  let delivered = 0;
  for (const n of pending) {
    const claimed = await prisma.notification.updateMany({ where: { id: n.id, pushedAt: null }, data: { pushedAt: new Date() } });
    if (claimed.count !== 1 || n.user.pushSubscriptions.length === 0) continue;
    const locale = isLocale(n.user.locale) ? n.user.locale : "fr";
    const params = (n.params ?? undefined) as Params | undefined;
    const payload = JSON.stringify({
      title: translate(locale, n.title, params),
      body: translate(locale, n.body, params),
      href: n.href ?? "/",
      tag: `${n.kind}-${n.id}`,
      kind: n.kind,
    });
    for (const s of n.user.pushSubscriptions) {
      const r = await send.send(s, payload);
      if (r === "ok") {
        delivered++;
        await prisma.pushSubscription.update({ where: { id: s.id }, data: { lastUsedAt: new Date() } });
      } else if (r === "gone") {
        await prisma.pushSubscription.deleteMany({ where: { id: s.id } });
      }
    }
  }
  return delivered;
}
