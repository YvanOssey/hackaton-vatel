import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";
import { prisma } from "@/server/db";
import { register } from "@/server/services/account";
import { approveUser } from "@/server/services/admin";
import { openCashSession } from "@/server/services/cash";
import { createLinkCode, linkChild, studentFamily, unlink } from "@/server/services/family";
import { inbox, markRead } from "@/server/services/notifications";
import { confirmTopUp, initiateTopUp } from "@/server/services/payments";
import { serveMeal } from "@/server/services/pos";
import { consumerOverview, familyOverview, kitchenOverview, publicMenuPreview } from "@/server/services/queries";
import { deleteMenu, saveMenu, setMenuPublished } from "@/server/services/menus";
import { addFavorite, listFavorites, removeFavorite, toggleFavoriteDish } from "@/server/services/favorites";
import { adjustBalance } from "@/server/services/admin";
import { cashTopUp } from "@/server/services/pos";
import { dishKey, matchesFavorite } from "@/lib/dishes";
import { translate } from "@/i18n/core";
import { readMenuPhoto, removeMenuPhoto, setMenuPhoto, sniffImage } from "@/server/services/photos";
import { MAX_PHOTO_BYTES } from "@/lib/photos";
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

describe("Vitrine publique", () => {
  it("montre le prochain menu publié, jamais un brouillon ni un jour passé, sans donnée personnelle", async () => {
    expect((await publicMenuPreview()).menu).toBeNull();
    await makeMenu("2026-11-16", { allergens: ["peanuts"] }); // hier
    await makeMenu(TODAY, { published: false }); // brouillon
    await makeMenu("2026-11-19", { allergens: ["peanuts"] });
    const preview = await publicMenuPreview();
    expect(preview.menu?.date).toBe("2026-11-19");
    expect(preview.menu?.dishes.map((d) => d.course)).toEqual(["STARTER", "MAIN", "DESSERT"]);
    expect(preview.menu?.dishes[1].allergens).toEqual(["peanuts"]);
    expect(preview.price).toBe(1500);
    expect(preview.rating).toBeNull(); // moins de 3 avis : pas de moyenne affichée
    expect(JSON.stringify(preview)).not.toMatch(/email|balance|passwordHash|userId/);
  });
});

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

describe("Photos des plats", () => {
  // En-têtes réels de fichiers (le contenu suffit au contrôle de format)
  const jpeg = () => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5, 6]);
  const webp = () => new Uint8Array([...Buffer.from("RIFF"), 0, 0, 0, 0, ...Buffer.from("WEBPVP8 "), 1, 2]);
  const svg = () => new Uint8Array(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'));

  it("le chef ajoute une photo, visible des étudiants sur le plat du menu", async () => {
    const chef = await makeUser({ role: "CHEF" });
    const student = await makeUser({ balance: 5000 });
    await makeMenu(TODAY);
    const { url } = await setMenuPhoto(chef, { date: TODAY, course: "MAIN" }, jpeg());
    expect(url.startsWith(`/api/photos/${TODAY}/MAIN?v=`)).toBe(true);
    const day = (await consumerOverview(student)).days.find((d) => d.date === TODAY)!;
    expect(day.menu!.dishes.find((d) => d.course === "MAIN")!.photo).toBe(url);
    expect(day.menu!.dishes.find((d) => d.course === "STARTER")!.photo).toBeNull();
    expect((await readMenuPhoto(TODAY, "MAIN"))!.mime).toBe("image/jpeg");
    expect(await prisma.auditLog.count({ where: { action: "menu.photo_set" } })).toBe(1);
  });

  it("accepte une photo avant l'enregistrement du menu et la remplace sans doublon", async () => {
    const chef = await makeUser({ role: "CHEF" });
    await setMenuPhoto(chef, { date: "2026-11-20", course: "DESSERT" }, jpeg());
    await setMenuPhoto(chef, { date: "2026-11-20", course: "DESSERT" }, webp());
    expect(await prisma.menuPhoto.count()).toBe(1);
    expect((await readMenuPhoto("2026-11-20", "DESSERT"))!.mime).toBe("image/webp");
    expect((await kitchenOverview(chef)).photos["2026-11-20:DESSERT"]).toContain("/api/photos/2026-11-20/DESSERT?v=");
  });

  it("refuse les étudiants, les jours passés, les formats non image et les fichiers trop lourds", async () => {
    const chef = await makeUser({ role: "CHEF" });
    const student = await makeUser();
    expect(await code(setMenuPhoto(student, { date: TODAY, course: "MAIN" }, jpeg()))).toBe("FORBIDDEN");
    expect(await code(setMenuPhoto(chef, { date: "2026-11-16", course: "MAIN" }, jpeg()))).toBe("PAST");
    expect(await code(setMenuPhoto(chef, { date: TODAY, course: "MAIN" }, svg()))).toBe("BAD_FORMAT");
    expect(await code(setMenuPhoto(chef, { date: TODAY, course: "MAIN" }, new Uint8Array(0)))).toBe("EMPTY");
    const big = new Uint8Array(MAX_PHOTO_BYTES + 1);
    big.set([0xff, 0xd8, 0xff]);
    expect(await code(setMenuPhoto(chef, { date: TODAY, course: "MAIN" }, big))).toBe("TOO_LARGE");
    await expect(setMenuPhoto(chef, { date: TODAY, course: "SOUPE" }, jpeg())).rejects.toBeInstanceOf(ZodError);
    expect(sniffImage(svg())).toBeNull();
    expect(await prisma.menuPhoto.count()).toBe(0);
  });

  it("retire une photo une seule fois, et la suppression d'un menu emporte ses photos", async () => {
    const chef = await makeUser({ role: "CHEF" });
    const menu = await makeMenu("2026-11-19", { published: false });
    await setMenuPhoto(chef, { date: "2026-11-19", course: "STARTER" }, jpeg());
    await setMenuPhoto(chef, { date: "2026-11-19", course: "MAIN" }, jpeg());
    await removeMenuPhoto(chef, { date: "2026-11-19", course: "STARTER" });
    expect(await code(removeMenuPhoto(chef, { date: "2026-11-19", course: "STARTER" }))).toBe("NOT_FOUND");
    await deleteMenu(chef, menu.id);
    expect(await prisma.menuPhoto.count()).toBe(0);
  });
});

describe("Notifications de crédit et de nouveau menu", () => {
  const dish = (name: string) => ({ name, allergens: [], kcal: 0, vegetarian: false });
  const menuInput = (date: string, publish: boolean, main = "Poulet yassa, riz blanc") => ({ date, nutriScore: "B" as const, publish, starter: dish("Salade"), main: dish(main), dessert: dish("Ananas") });
  const kinds = async (u: { id: string }) => (await prisma.notification.findMany({ where: { userId: u.id }, orderBy: { createdAt: "asc" } })).map((n) => n.kind);

  it("prévient l'étudiant et ses parents de chaque crédit : espèces, Mobile Money, administration", async () => {
    const { child, parent } = await linkedFamily(0);
    const cashier = await makeUser({ role: "CASHIER" });
    const admin = await makeUser({ role: "ADMIN" });
    await prisma.notification.deleteMany();
    await openCashSession(cashier, 0);
    await cashTopUp(cashier, child.id, 2000);
    const cash = await prisma.notification.findFirstOrThrow({ where: { userId: child.id, kind: "topup" } });
    expect(translate("fr", cash.body, cash.params as Record<string, number>)).toBe("2 000 FCFA ajoutés en espèces au comptoir. Nouveau solde : 2 000 FCFA.");
    expect(await kinds(parent)).toEqual(["topup"]);

    const intent = await initiateTopUp(child, { beneficiaryId: child.id, provider: "WAVE", phone: "0708091011", amount: 1000 });
    await confirmTopUp(child, intent.id);
    await adjustBalance(admin, child.id, 500, "Geste commercial");
    await adjustBalance(admin, child.id, -200, "Correction de caisse");
    // 3 crédits (espèces, Wave, administration) ; la correction négative ne déclenche rien
    expect(await kinds(child)).toEqual(["topup", "topup", "topup"]);
  });

  it("annonce un menu publié une seule fois ; le plat préféré remplace l'annonce générale", async () => {
    const chef = await makeUser({ role: "CHEF" });
    const fan = await makeUser();
    const other = await makeUser();
    const pending = await makeUser({ status: "PENDING" });
    await addFavorite(fan, "poulet YASSA");
    await prisma.notification.deleteMany();

    await saveMenu(chef, menuInput("2026-11-19", false));
    expect(await prisma.notification.count()).toBe(0); // brouillon : silence
    await saveMenu(chef, menuInput("2026-11-19", true));
    expect(await kinds(other)).toEqual(["menu"]);
    expect(await kinds(fan)).toEqual(["favorite"]);
    expect(await kinds(pending)).toEqual([]);
    const fav = await prisma.notification.findFirstOrThrow({ where: { userId: fan.id } });
    expect(translate("fr", fav.body, fav.params as Record<string, string>)).toBe("Poulet yassa, riz blanc sera servi le jeudi 19 novembre. Réservez votre repas.");
    expect(translate("en", fav.body, fav.params as Record<string, string>)).toBe("Poulet yassa, riz blanc will be served on Thursday 19 November. Book your meal.");

    await saveMenu(chef, menuInput("2026-11-19", true)); // simple correction du menu publié
    expect(await prisma.notification.count({ where: { userId: other.id } })).toBe(1);

    // Publication depuis le planning (brouillon → publié)
    const draft = await saveMenu(chef, menuInput("2026-11-20", false, "Attiéké poisson"));
    await setMenuPublished(chef, draft.id, true);
    expect(await kinds(other)).toEqual(["menu", "menu"]);
  });

  it("gère les plats préférés : sans doublon, cœur bascule, cloisonné par étudiant", async () => {
    const a = await makeUser();
    const b = await makeUser();
    expect(dishKey("  Poulet Yassa, riz BLANC ")).toBe("poulet yassa riz blanc");
    expect(matchesFavorite("Attiéké poisson braisé", dishKey("attieke"))).toBe(true);
    expect(matchesFavorite("Pouletyassa", dishKey("poulet yassa"))).toBe(false);
    const f = await addFavorite(a, "Attiéké");
    await addFavorite(a, "attieke");
    expect(await listFavorites(a)).toHaveLength(1);
    expect((await toggleFavoriteDish(a, "Attiéké poisson")).added).toBe(false); // déjà couvert : le cœur retire
    expect(await listFavorites(a)).toHaveLength(0);
    expect((await toggleFavoriteDish(a, "Alloco")).added).toBe(true);
    const mine = (await listFavorites(a))[0];
    expect(await code(removeFavorite(b, mine.id))).toBe("NOT_FOUND");
    expect(await code(addFavorite(await makeUser({ role: "CHEF" }), "Riz"))).toBe("FORBIDDEN");
    for (let i = 0; i < 19; i++) await addFavorite(a, `Plat numéro ${i}`);
    expect(await code(addFavorite(a, "Un plat de trop"))).toBe("LIMIT");
    expect(f.name).toBe("Attiéké");
  });
});
