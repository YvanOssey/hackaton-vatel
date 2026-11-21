import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/server/db";
import { passToken } from "@/server/pass";
import { cancelReservation, reserveMeal } from "@/server/services/reservations";
import { cashTopUp, lookupByPass, serveMeal } from "@/server/services/pos";
import { looksLikePass, normalizeScan } from "@/lib/pass-scan";
import { closeCashSession, openCashSession } from "@/server/services/cash";
import { adjustBalance, approveUser, setSuspended, updateSettings } from "@/server/services/admin";
import { saveMenu, setMenuPublished } from "@/server/services/menus";
import { register, authenticate } from "@/server/services/account";
import { TODAY, TOMORROW, balanceOf, makeMenu, makeUser, resetDb, setTime } from "./helpers";

const code = (p: Promise<unknown>) => p.then(() => "OK", (e: { code?: string }) => e.code ?? String(e));

beforeEach(async () => {
  vi.useRealTimers();
  await resetDb();
  setTime("08:00");
});
afterAll(async () => {
  vi.useRealTimers();
  await prisma.$disconnect();
});

describe("Réservations", () => {
  it("refuse un compte en attente de validation", async () => {
    await makeMenu(TOMORROW);
    const u = await makeUser({ status: "PENDING", balance: 10_000 });
    expect(await code(reserveMeal(u, TOMORROW))).toBe("PENDING");
  });

  it("réserve, fige le tarif et refuse le doublon", async () => {
    await makeMenu(TOMORROW);
    const u = await makeUser({ balance: 5_000 });
    await reserveMeal(u, TOMORROW);
    expect(await code(reserveMeal(u, TOMORROW))).toBe("DUPLICATE");
    const r = await prisma.reservation.findFirstOrThrow({ where: { userId: u.id } });
    expect(r.price).toBe(1_500);
    expect(await balanceOf(u.id)).toBe(5_000); // la réservation engage sans débiter
  });

  it("tient compte des montants déjà engagés", async () => {
    await makeMenu(TODAY);
    await makeMenu(TOMORROW);
    const u = await makeUser({ balance: 2_000 });
    await reserveMeal(u, TODAY);
    expect(await code(reserveMeal(u, TOMORROW))).toBe("INSUFFICIENT");
  });

  it("applique l'heure limite le jour même uniquement", async () => {
    await makeMenu(TODAY);
    await makeMenu(TOMORROW);
    const u = await makeUser({ balance: 10_000 });
    setTime("10:30");
    expect(await code(reserveMeal(u, TODAY))).toBe("CLOSED");
    expect(await code(reserveMeal(u, TOMORROW))).toBe("OK");
  });

  it("refuse un jour sans menu publié et un jour passé", async () => {
    await makeMenu(TOMORROW, { published: false });
    await makeMenu("2026-11-16");
    const u = await makeUser({ balance: 10_000 });
    expect(await code(reserveMeal(u, TOMORROW))).toBe("NO_MENU");
    expect(await code(reserveMeal(u, "2026-11-16"))).toBe("CLOSED");
  });

  it("annule avant l'heure limite, jamais la réservation d'un autre", async () => {
    await makeMenu(TODAY);
    const a = await makeUser({ balance: 5_000 });
    const b = await makeUser({ balance: 5_000 });
    const { reservation } = await reserveMeal(a, TODAY);
    expect(await code(cancelReservation(b, reservation.id))).toBe("NOT_FOUND");
    setTime("10:01");
    expect(await code(cancelReservation(a, reservation.id))).toBe("CLOSED");
    setTime("09:59");
    expect(await code(cancelReservation(a, reservation.id))).toBe("OK");
  });
});

describe("Caisse", () => {
  async function cashier() {
    const c = await makeUser({ role: "CASHIER" });
    await openCashSession(c, 10_000);
    return c;
  }

  it("exige une caisse ouverte et un rôle caissier", async () => {
    await makeMenu(TODAY);
    const consumer = await makeUser({ balance: 5_000 });
    const c = await makeUser({ role: "CASHIER" });
    expect(await code(serveMeal(c, consumer.id, false))).toBe("NO_SESSION");
    expect(await code(serveMeal(consumer, consumer.id, false))).toBe("FORBIDDEN");
  });

  it("débite le tarif figé à la réservation et refuse le double passage", async () => {
    await makeMenu(TODAY);
    const u = await makeUser({ balance: 5_000 });
    await reserveMeal(u, TODAY);
    const admin = await makeUser({ role: "ADMIN" });
    const s = await prisma.settings.findUniqueOrThrow({ where: { id: 1 } });
    await updateSettings(admin, { ...s, priceStudent: 2_000 });
    const c = await cashier();
    await serveMeal(c, u.id, false);
    expect(await balanceOf(u.id)).toBe(3_500);
    expect(await code(serveMeal(c, u.id, false))).toBe("ALREADY_SERVED");
    expect(await balanceOf(u.id)).toBe(3_500);
  });

  it("bloque tant que l'alerte allergène n'est pas confirmée", async () => {
    await makeMenu(TODAY, { allergens: ["arachides"] });
    const u = await makeUser({ balance: 5_000, allergens: ["arachides"] });
    const c = await cashier();
    expect(await code(serveMeal(c, u.id, false))).toBe("ALLERGEN_ACK_REQUIRED");
    expect(await code(serveMeal(c, u.id, true))).toBe("OK");
    const r = await prisma.reservation.findFirstOrThrow({ where: { userId: u.id } });
    expect(r.allergenOverride).toBe(true);
  });

  it("gère solde insuffisant, repas sans réservation et compte non validé", async () => {
    await makeMenu(TODAY);
    const c = await cashier();
    const poor = await makeUser({ balance: 1_000 });
    expect(await code(serveMeal(c, poor.id, false))).toBe("INSUFFICIENT");
    const walkIn = await makeUser({ balance: 5_000 });
    await serveMeal(c, walkIn.id, false);
    expect(await balanceOf(walkIn.id)).toBe(3_500);
    const pending = await makeUser({ status: "PENDING", balance: 5_000 });
    expect(await code(serveMeal(c, pending.id, false))).toBe("INACTIVE");
    const admin = await makeUser({ role: "ADMIN" });
    const s = await prisma.settings.findUniqueOrThrow({ where: { id: 1 } });
    await updateSettings(admin, { ...s, allowWalkIn: false });
    const other = await makeUser({ balance: 5_000 });
    expect(await code(serveMeal(c, other.id, false))).toBe("WALK_IN_DISABLED");
  });

  it("ne débite qu'une fois en cas de validations simultanées", async () => {
    await makeMenu(TODAY);
    const u = await makeUser({ balance: 5_000 });
    const c1 = await cashier();
    const c2 = await cashier();
    const results = await Promise.all([code(serveMeal(c1, u.id, false)), code(serveMeal(c2, u.id, false))]);
    expect(results.sort()).toEqual(["ALREADY_SERVED", "OK"]);
    expect(await balanceOf(u.id)).toBe(3_500);
    expect(await prisma.transaction.count({ where: { userId: u.id, type: "MEAL" } })).toBe(1);
  });

  it("refuse un QR falsifié ou révoqué", async () => {
    const u = await makeUser();
    const c = await cashier();
    const token = passToken(u.id, 1);
    expect((await lookupByPass(c, token)).user.id).toBe(u.id);
    expect(await code(lookupByPass(c, token.slice(0, -2) + "xx"))).toBe("INVALID_PASS");
    expect(await code(lookupByPass(c, passToken(u.id, 1).replace(u.id, (await makeUser()).id)))).toBe("INVALID_PASS");
    await prisma.user.update({ where: { id: u.id }, data: { passVersion: 2 } });
    expect(await code(lookupByPass(c, token))).toBe("REVOKED_PASS");
  });

  it("lit le pass d'une douchette QWERTY branchée sur un poste AZERTY, et le préfixe CANTINE:", async () => {
    const u = await makeUser();
    const c = await cashier();
    const token = passToken(u.id, 1);
    // Ce que tape une douchette QWERTY sur un poste AZERTY
    const qwertyToAzerty: Record<string, string> = { "1": "&", "2": "é", "3": '"', "4": "'", "5": "(", "6": "-", "7": "è", "8": "_", "9": "ç", "0": "à", q: "a", a: "q", w: "z", z: "w", Q: "A", A: "Q", W: "Z", Z: "W", m: ",", M: "?", ".": ":", "-": ")", _: "°" };
    const typed = [...token].map((ch) => qwertyToAzerty[ch] ?? ch).join("");
    expect(typed.startsWith("CC&:")).toBe(true);
    expect(looksLikePass(typed)).toBe(true);
    expect(normalizeScan(typed)).toBe(token);
    expect((await lookupByPass(c, typed)).user.id).toBe(u.id);
    expect((await lookupByPass(c, `CANTINE:${token}`)).user.id).toBe(u.id);
    expect(looksLikePass("Jean Dupont")).toBe(false);
    expect(normalizeScan("Jean Dupont")).toBe("Jean Dupont");
  });
});

describe("Clôture de caisse", () => {
  it("calcule l'attendu, exige un motif en cas d'écart et interdit deux caisses ouvertes", async () => {
    await makeMenu(TODAY);
    const c = await makeUser({ role: "CASHIER" });
    await openCashSession(c, 10_000);
    expect(await code(openCashSession(c, 0))).toBe("ALREADY_OPEN");
    const u = await makeUser({ balance: 0 });
    await cashTopUp(c, u.id, 5_000);
    await serveMeal(c, u.id, false); // repas débité du portefeuille : n'entre pas en espèces
    expect(await code(closeCashSession(c, 14_500))).toBe("NOTE_REQUIRED");
    const { session, totals } = await closeCashSession(c, 14_500, "Erreur de rendu monnaie");
    expect(totals.expectedCash).toBe(15_000);
    expect(session.difference).toBe(-500);
    expect(totals.mealCount).toBe(1);
    expect(await code(cashTopUp(c, u.id, 1_000))).toBe("NO_SESSION");
  });
});

describe("Administration et comptes", () => {
  it("inscrit un étudiant en attente, refuse un numéro déjà pris, puis le valide", async () => {
    const user = await register({
      firstName: "Awa", lastName: "Koné", email: "AWA@test.local", memberRef: "E-123", allergens: ["lait"], password: "motdepasse12",
    });
    expect(user.status).toBe("PENDING");
    expect(user.tariffGroup).toBe("STUDENT");
    expect(await code(register({ firstName: "X", lastName: "Y", email: "x@test.local", memberRef: "e-123", allergens: [], password: "motdepasse12" }))).toBe("DUPLICATE");
    const admin = await makeUser({ role: "ADMIN" });
    await approveUser(admin, user.id);
    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect([after.status, after.tariffGroup]).toEqual(["ACTIVE", "STUDENT"]);
    expect((await authenticate("awa@test.local", "motdepasse12")).id).toBe(user.id);
  });

  it("limite les tentatives de connexion", async () => {
    await register({ firstName: "A", lastName: "B", email: "b@test.local", memberRef: "E-777", allergens: [], password: "motdepasse12" });
    for (let i = 0; i < 5; i++) expect(await code(authenticate("b@test.local", "mauvais"))).toBe("INVALID_CREDENTIALS");
    expect(await code(authenticate("b@test.local", "motdepasse12"))).toBe("RATE_LIMITED");
  });

  it("interdit un solde négatif, un usager hors de l'admin et la suspension du dernier admin", async () => {
    const admin = await makeUser({ role: "ADMIN" });
    const u = await makeUser({ balance: 1_000 });
    expect(await code(adjustBalance(admin, u.id, -2_000, "Correction erreur"))).toBe("BUSINESS");
    expect(await code(adjustBalance(u, u.id, 50_000, "Je me crédite"))).toBe("FORBIDDEN");
    const other = await makeUser({ role: "ADMIN" });
    await setSuspended(admin, other.id, true);
    // admin est désormais le seul administrateur actif : il ne peut pas être suspendu
    expect(await code(setSuspended(other, admin.id, true))).toBe("BUSINESS");
    expect(await prisma.user.findUniqueOrThrow({ where: { id: admin.id } }).then((x) => x.status)).toBe("ACTIVE");
  });

  it("ne dépublie pas un menu réservé", async () => {
    const chef = await makeUser({ role: "CHEF" });
    const menu = await makeMenu(TOMORROW);
    const u = await makeUser({ balance: 5_000 });
    await reserveMeal(u, TOMORROW);
    expect(await code(setMenuPublished(chef, menu.id, false))).toBe("HAS_RESERVATIONS");
    expect(await code(saveMenu(u, { date: TOMORROW, nutriScore: "A", publish: true, starter: { name: "aa", allergens: [], kcal: 0, vegetarian: false }, main: { name: "bb", allergens: [], kcal: 0, vegetarian: false }, dessert: { name: "cc", allergens: [], kcal: 0, vegetarian: false } }))).toBe("FORBIDDEN");
  });
});
