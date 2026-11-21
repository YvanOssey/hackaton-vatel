import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/server/db";
import { notify } from "@/server/notify";
import { flushPush, isAllowedEndpoint, setPushSender, type PushResult } from "@/server/push";
import { openCashSession } from "@/server/services/cash";
import { createLinkCode, linkChild } from "@/server/services/family";
import { serveMeal } from "@/server/services/pos";
import { sendTestPush, subscribePush, unsubscribePush } from "@/server/services/push";
import { reserveMeal } from "@/server/services/reservations";
import { TODAY, makeMenu, makeUser, resetDb, setTime } from "./helpers";

const code = (p: Promise<unknown>) => p.then(() => "OK", (e: { code?: string; issues?: unknown }) => e.code ?? (e.issues ? "VALIDATION" : String(e)));
const FCM = (id: string) => `https://fcm.googleapis.com/fcm/send/${id}`;
const keys = { p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", auth: "tBHItJI5svbpez7KI4CCXg" };

/** Faux service de push : garde les messages, et simule un appareil désinstallé */
let sent: { endpoint: string; payload: { title: string; body: string; href: string } }[] = [];
let answer: (endpoint: string) => PushResult = () => "ok";

beforeAll(() => {
  process.env.VAPID_PUBLIC_KEY = "test-public-key";
  process.env.VAPID_PRIVATE_KEY = "test-private-key";
  setPushSender({
    async send(target, payload) {
      sent.push({ endpoint: target.endpoint, payload: JSON.parse(payload) });
      return answer(target.endpoint);
    },
  });
});
beforeEach(async () => {
  vi.useRealTimers();
  await resetDb();
  sent = [];
  answer = () => "ok";
});
afterAll(async () => {
  setPushSender(null);
  vi.useRealTimers();
  await prisma.$disconnect();
});

describe("Notifications push", () => {
  it("n'accepte que les services de push des navigateurs", async () => {
    expect(isAllowedEndpoint(FCM("abc"))).toBe(true);
    expect(isAllowedEndpoint("https://web.push.apple.com/QGx")).toBe(true);
    expect(isAllowedEndpoint("http://fcm.googleapis.com/x")).toBe(false);
    expect(isAllowedEndpoint("https://169.254.169.254/latest")).toBe(false);
    expect(isAllowedEndpoint("https://fcm.googleapis.com.evil.test/x")).toBe(false);
    const u = await makeUser();
    expect(await code(subscribePush(u, { endpoint: "https://evil.test/hook", keys }, { locale: "fr" }))).toBe("VALIDATION");
  });

  it("prévient le parent sur son téléphone, dans sa langue, une seule fois", async () => {
    const child = await makeUser({ balance: 2500 });
    const parent = await makeUser({ role: "PARENT" });
    await linkChild(parent, (await createLinkCode(child)).code);
    await subscribePush(parent, { endpoint: FCM("parent-phone"), keys }, { locale: "en" });
    await subscribePush(child, { endpoint: FCM("child-phone"), keys }, { locale: "fr" });
    await flushPush(); // notification d'association envoyée à l'étudiant
    sent = [];

    setTime("08:00");
    const cashier = await makeUser({ role: "CASHIER" });
    await makeMenu(TODAY);
    await openCashSession(cashier, 0);
    await reserveMeal(child, TODAY);
    await serveMeal(cashier, child.id, false);
    vi.useRealTimers();

    expect(await flushPush()).toBe(3); // repas + solde bas au parent, solde bas à l'étudiant
    const toParent = sent.filter((s) => s.endpoint === FCM("parent-phone")).map((s) => s.payload);
    expect(toParent.map((p) => p.title).sort()).toEqual([`${child.firstName} had lunch`, `Low balance for ${child.firstName}`].sort());
    expect(toParent.find((p) => p.title.endsWith("had lunch"))!.body).toContain("1,500 FCFA charged");
    expect(toParent[0].href).toBe("/famille");
    const toChild = sent.filter((s) => s.endpoint === FCM("child-phone")).map((s) => s.payload);
    expect(toChild.map((p) => p.title)).toEqual(["Solde bas"]);

    sent = [];
    expect(await flushPush()).toBe(0);
  });

  it("supprime l'abonnement d'un appareil désinstallé et ignore les vieilles notifications", async () => {
    const u = await makeUser();
    await subscribePush(u, { endpoint: FCM("old-phone"), keys }, { locale: "fr" });
    await subscribePush(u, { endpoint: FCM("new-phone"), keys }, { locale: "fr" });
    answer = (e) => (e.includes("old") ? "gone" : "ok");
    await sendTestPush(u);
    expect(await flushPush()).toBe(1);
    expect((await prisma.pushSubscription.findMany({ where: { userId: u.id } })).map((s) => s.endpoint)).toEqual([FCM("new-phone")]);

    sent = [];
    await notify(prisma, [u.id], { kind: "account", title: "Compte validé", body: "…" });
    await prisma.notification.updateMany({ where: { pushedAt: null }, data: { createdAt: new Date(Date.now() - 2 * 3600_000) } });
    expect(await flushPush()).toBe(0);
    expect(sent).toEqual([]);
    expect(await prisma.notification.count({ where: { pushedAt: null } })).toBe(0);
  });

  it("rattache l'appareil au dernier compte connecté et permet de se désabonner", async () => {
    const a = await makeUser();
    const b = await makeUser();
    await subscribePush(a, { endpoint: FCM("shared"), keys }, { locale: "fr" });
    await subscribePush(b, { endpoint: FCM("shared"), keys }, { locale: "en" });
    const sub = await prisma.pushSubscription.findUniqueOrThrow({ where: { endpoint: FCM("shared") } });
    expect(sub.userId).toBe(b.id);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: b.id } })).locale).toBe("en");
    await unsubscribePush(a, FCM("shared")); // ne touche pas l'abonnement d'un autre compte
    expect(await prisma.pushSubscription.count()).toBe(1);
    await unsubscribePush(b, FCM("shared"));
    expect(await prisma.pushSubscription.count()).toBe(0);
    expect(await code(sendTestPush(b))).toBe("NOT_SUBSCRIBED");
  });
});
