"use server";

import { headers } from "next/headers";
import { getLocale } from "@/i18n/server";
import { currentActor } from "@/server/actor";
import { run } from "@/server/errors";
import { sendTestPush, subscribePush, unsubscribePush } from "@/server/services/push";

export async function subscribePushAction(subscription: unknown) {
  return run(async () => {
    await subscribePush(await currentActor(), subscription, { userAgent: (await headers()).get("user-agent"), locale: await getLocale() });
  }, "Vous recevrez les notifications sur cet appareil.");
}

export async function unsubscribePushAction(endpoint: string) {
  return run(async () => unsubscribePush(await currentActor(), String(endpoint)), "Notifications désactivées sur cet appareil.");
}

export async function testPushAction() {
  return run(async () => sendTestPush(await currentActor()), "Notification envoyée : elle arrive dans quelques secondes.");
}
