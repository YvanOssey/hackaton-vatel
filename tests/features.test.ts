import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/server/db";
import { register } from "@/server/services/account";
import { approveUser } from "@/server/services/admin";
import { openCashSession } from "@/server/services/cash";
import { createLinkCode, linkChild, studentFamily, unlink } from "@/server/services/family";
import { inbox, markRead } from "@/server/services/notifications";
import { confirmTopUp, initiateTopUp } from "@/server/services/payments";
import { serveMeal } from "@/server/services/pos";
import { familyOverview, kitchenOverview } from "@/server/services/queries";
import { rateMeal, ratingsSummary } from "@/server/services/ratings";
import { reserveMeal } from "@/server/services/reservations";
import { TODAY, balanceOf, makeMenu, makeUser, resetDb, setTime } from "./helpers";

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

async function linkedFamily(balance = 0) {
  const child = await makeUser({ balance });
  const parent = await makeUser({ role: "PARENT" });
  const { code: c } = await createLinkCode(child);
  await linkChild(parent, c);
  return { child, parent };
}

describe("Comptes parents", () => {
  it("crée un compte parent actif sans numéro étudiant", async () => {
    const p = await register({ accountType: "PARENT", firstName: "Awa", lastName: "Koné", email: "maman@test.local", password: "motdepasse12" });
    expect(p.role).toBe("PARENT");
    expect(p.status).toBe("ACTIVE");
    expect(await code(register({ accountType: "STUDENT", firstName: "A", lastName: "B", email: "e@test.local", password: "motdepasse12" }))).toBe("VALIDATION");
  });

  it("associe un parent avec le code de l'étudiant, à usage unique, insensible à la casse", async () => {
    const child = await makeUser();
    const parent = await makeUser({ role: "PARENT" });
    const other = await makeUser({ role: "PARENT" });
    const { code: c } = await createLinkCode(child);
    expect(c).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    await linkChild(parent, ` ${c.toLowerCase().replace("-", " ")} `);
    expect(await code(linkChild(other, c))).toBe("INVALID_CODE");
    expect((await studentFamily(child)).parents).toHaveLength(1);
    expect((await inbox(child)).items[0].kind).toBe("family");
  });

  it("refuse un code expiré et limite les essais", async () => {
    const child = await makeUser();
    const parent = await makeUser({ role: "PARENT" });
    const { code: c } = await createLinkCode(child);
    setTime("08:00", "2026-11-20");
    expect(await code(linkChild(parent, c))).toBe("INVALID_CODE");
    for (let i = 0; i < 4; i++) await code(linkChild(parent, "AAAA-AAAA"));
    expect(await code(linkChild(parent, "AAAA-AAAA"))).toBe("RATE_LIMITED");
  });

  it("isole les données : un parent ne voit et ne recharge que ses enfants", async () => {
    const { child, parent } = await linkedFamily(3000);
    const stranger = await makeUser({ balance: 1000 });
    const overview = await familyOverview(parent);
    expect(overview.children.map((c) => c.id)).toEqual([child.id]);
    expect(await code(initiateTopUp(parent, { beneficiaryId: stranger.id, provider: "WAVE", phone: "0707070707", amount: 1000 }))).toBe("FORBIDDEN");
    expect(await code(familyOverview(child))).toBe("FORBIDDEN");
    await unlink(child, parent.id);
    expect((await familyOverview(parent)).children).toHaveLength(0);
  });
});

describe("Rechargement Mobile Money", () => {
  it("crédite une seule fois, même si la confirmation est rejouée", async () => {
    const { child, parent } = await linkedFamily(500);
    const intent = await initiateTopUp(parent, { beneficiaryId: child.id, provider: "ORANGE_MONEY", phone: "+225 07 08 09 10 11", amount: 5000 });
    expect(intent.phone).toBe("0708091011");
    const [a, b] = await Promise.all([confirmTopUp(parent, intent.id), confirmTopUp(parent, intent.id)]);
    expect([a.status, b.status]).toEqual(["SUCCEEDED", "SUCCEEDED"]);
    expect(await balanceOf(child.id)).toBe(5500);
    const tx = await prisma.transaction.findMany({ where: { userId: child.id, method: "MOBILE_MONEY" } });
    expect(tx).toHaveLength(1);
    expect((await inbox(child)).items.some((n) => n.kind === "topup")).toBe(true);
  });

  it("refuse un numéro invalide, gère le refus opérateur et l'expiration", async () => {
    const u = await makeUser();
    expect(await code(initiateTopUp(u, { beneficiaryId: u.id, provider: "WAVE", phone: "0123", amount: 1000 }))).toBe("VALIDATION");
    const failed = await initiateTopUp(u, { beneficiaryId: u.id, provider: "WAVE", phone: "0700000000", amount: 1000 });
    expect((await confirmTopUp(u, failed.id)).status).toBe("FAILED");
    const late = await initiateTopUp(u, { beneficiaryId: u.id, provider: "WAVE", phone: "0701020304", amount: 1000 });
    setTime("08:20");
    expect((await confirmTopUp(u, late.id)).status).toBe("EXPIRED");
    expect(await balanceOf(u.id)).toBe(0);
    const other = await makeUser();
    expect(await code(confirmTopUp(other, late.id))).toBe("NOT_FOUND");
  });
});

describe("Repas, notifications et notes", () => {
  it("prévient le parent du repas et du solde bas, puis l'étudiant note son repas", async () => {
    const { child, parent } = await linkedFamily(2500);
    const cashier = await makeUser({ role: "CASHIER" });
    await makeMenu(TODAY);
    await openCashSession(cashier, 0);
    const { reservation: res } = await reserveMeal(child, TODAY);
    expect(await code(rateMeal(child, res.id, { score: 5 }))).toBe("NOT_SERVED");
    await serveMeal(cashier, child.id, false);

    const kinds = (await inbox(parent)).items.map((n) => n.kind).sort();
    expect(kinds).toEqual(["low_balance", "meal_served"]);
    expect((await inbox(child)).unread).toBe(2); // association + solde bas
    await markRead(child);
    expect((await inbox(child)).unread).toBe(0);

    await rateMeal(child, res.id, { score: 4, comment: "Très bon yassa" });
    await rateMeal(child, res.id, { score: 5 });
    await expect(rateMeal(child, res.id, { score: 6 })).rejects.toThrow("note de 1 à 5");
    const other = await makeUser();
    expect(await code(rateMeal(other, res.id, { score: 3 }))).toBe("NOT_FOUND");

    const chef = await makeUser({ role: "CHEF" });
    const summary = await ratingsSummary(chef);
    expect(summary.count).toBe(1);
    expect(summary.average).toBe(5);
    expect((await familyOverview(parent)).children[0].meals[0].rating).toBe(5);
  });

  it("annonce la validation du compte et prévoit la production avec les passages sans réservation", async () => {
    const admin = await makeUser({ role: "ADMIN" });
    const pending = await makeUser({ status: "PENDING" });
    await approveUser(admin, pending.id);
    expect((await inbox(pending)).items[0].title).toBe("Compte validé");

    // Deux passages sans réservation il y a une semaine, le même jour
    const lastWeek = "2026-11-10";
    for (const u of [await makeUser(), await makeUser()]) {
      await prisma.reservation.create({ data: { userId: u.id, date: new Date(`${lastWeek}T00:00:00Z`), status: "SERVED", price: 1500, walkIn: true } });
    }
    const chef = await makeUser({ role: "CHEF" });
    const today = (await kitchenOverview(chef)).days.find((d) => d.date === TODAY)!;
    expect(today.walkInAvg).toBe(2);
    expect(today.forecast).toBe(today.total + 2);
  });
});
