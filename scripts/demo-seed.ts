/**
 * Jeu de données de démonstration (local uniquement) : personnel, étudiants, un parent associé,
 * deux semaines d'historique (menus, repas servis, passages sans réservation, notes) et le stock.
 *
 *   npm run db:demo
 *
 * Idempotent : ne fait rien si les comptes de démonstration existent déjà.
 * Refuse de tourner en production sans --force.
 */
import { PrismaClient, type Course, type NutriScore } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const PASSWORD = "Demo2026cantine";
const PRICE = 1500;
const TZ = process.env.APP_TIMEZONE?.trim().replace(/^["']|["']$/g, "") || "Africa/Abidjan";

if (process.env.NODE_ENV === "production" && !process.argv.includes("--force")) {
  console.error("[demo] Refusé en production (ajoutez --force si c'est voulu).");
  process.exit(1);
}

// Générateur pseudo-aléatoire déterministe : la démo est identique à chaque chargement
let seed = 20261118;
const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)];
const cycle = <T,>(a: T[], i: number) => a[((i % a.length) + a.length) % a.length];

const today = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const D = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const add = (iso: string, n: number) => {
  const d = D(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const weekday = (iso: string) => D(iso).getUTCDay() % 6 !== 0;
const at = (iso: string, h: number, m: number) => new Date(`${iso}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00.000Z`);

type DishSeed = { name: string; allergens: string[]; kcal: number; vegetarian?: boolean };
const STARTERS: DishSeed[] = [
  { name: "Salade de crudités", allergens: ["moutarde"], kcal: 120, vegetarian: true },
  { name: "Avocat vinaigrette", allergens: ["moutarde"], kcal: 210, vegetarian: true },
  { name: "Salade de pâtes au thon", allergens: ["gluten", "poissons", "oeufs"], kcal: 260 },
  { name: "Soupe de légumes", allergens: ["celeri"], kcal: 110, vegetarian: true },
  { name: "Carottes râpées au citron", allergens: [], kcal: 90, vegetarian: true },
];
const MAINS: (DishSeed & { appeal: number })[] = [
  { name: "Poulet yassa, riz parfumé", allergens: ["moutarde"], kcal: 680, appeal: 4.6 },
  { name: "Attiéké poisson braisé", allergens: ["poissons"], kcal: 640, appeal: 4.7 },
  { name: "Sauce graine, riz blanc", allergens: [], kcal: 720, appeal: 4.2 },
  { name: "Alloco, œufs et sauce tomate", allergens: ["oeufs"], kcal: 610, appeal: 4.4, vegetarian: true },
  { name: "Garba au thon", allergens: ["poissons"], kcal: 700, appeal: 4.5 },
  { name: "Sauce arachide et foutou banane", allergens: ["arachides"], kcal: 750, appeal: 4.1 },
  { name: "Spaghetti bolognaise", allergens: ["gluten", "celeri"], kcal: 690, appeal: 3.9 },
  { name: "Riz gras aux légumes", allergens: [], kcal: 620, appeal: 3.6, vegetarian: true },
  { name: "Kédjénou de poulet, attiéké", allergens: [], kcal: 660, appeal: 4.6 },
  { name: "Placali sauce kplala", allergens: ["poissons", "crustaces"], kcal: 640, appeal: 3.4 },
];
const DESSERTS: DishSeed[] = [
  { name: "Ananas frais", allergens: [], kcal: 80, vegetarian: true },
  { name: "Yaourt nature", allergens: ["lait"], kcal: 110, vegetarian: true },
  { name: "Banane", allergens: [], kcal: 95, vegetarian: true },
  { name: "Gâteau au chocolat", allergens: ["gluten", "oeufs", "lait"], kcal: 320, vegetarian: true },
  { name: "Salade de mangue", allergens: [], kcal: 100, vegetarian: true },
];
const COMMENTS: Record<number, string[]> = {
  5: ["Excellent, comme à la maison !", "Le poisson était parfait.", "Meilleur repas de la semaine."],
  4: ["Très bon, portion généreuse.", "Bien assaisonné."],
  3: ["Correct mais un peu froid.", "Un peu trop salé."],
  2: ["Portion trop petite.", "Le riz était trop cuit."],
};

const STUDENTS = [
  ["Aya", "Kouassi", ["arachides"]],
  ["Koffi", "Yao", []],
  ["Mariam", "Traoré", ["lait"]],
  ["Ibrahim", "Coulibaly", []],
  ["Fatou", "Diabaté", ["poissons", "crustaces"]],
  ["Jean-Marc", "N'Guessan", []],
  ["Awa", "Konaté", []],
  ["Serge", "Bamba", ["gluten"]],
  ["Adjoua", "Kassi", []],
  ["Moussa", "Ouattara", []],
  ["Grâce", "Aka", ["oeufs"]],
  ["Yannick", "Tano", []],
] as const;

async function main() {
  if (await prisma.user.findFirst({ where: { email: { endsWith: "@demo.cantine" } } })) {
    console.log("[demo] Données de démonstration déjà chargées.");
    return;
  }
  const hash = await bcrypt.hash(PASSWORD, 11);
  await prisma.settings.upsert({ where: { id: 1 }, update: { establishmentName: "Restaurant universitaire Vatel", priceStudent: PRICE }, create: { id: 1, establishmentName: "Restaurant universitaire Vatel", priceStudent: PRICE } });

  const cashier = await prisma.user.create({ data: { email: "caisse@demo.cantine", passwordHash: hash, firstName: "Paul", lastName: "Kouadio", role: "CASHIER", status: "ACTIVE", tariffGroup: "STAFF" } });
  await prisma.user.create({ data: { email: "chef@demo.cantine", passwordHash: hash, firstName: "Rose", lastName: "Ahoua", role: "CHEF", status: "ACTIVE", tariffGroup: "STAFF" } });

  // Menus : deux semaines passées, la semaine en cours et la suivante
  const menus = new Map<string, { id: string; appeal: number }>();
  for (let i = -16; i <= 11; i++) {
    const date = add(today, i);
    if (!weekday(date)) continue;
    const existing = await prisma.menu.findUnique({ where: { date: D(date) }, include: { dishes: true } });
    if (existing) {
      const main = MAINS.find((m) => existing.dishes.some((d) => d.name === m.name));
      menus.set(date, { id: existing.id, appeal: main?.appeal ?? 4 });
      continue;
    }
    const main = cycle(MAINS, i);
    const starter = cycle(STARTERS, i);
    const dessert = cycle(DESSERTS, i * 3);
    const dish = (course: Course, d: DishSeed) => ({ course, name: d.name, allergens: d.allergens, kcal: d.kcal, vegetarian: !!d.vegetarian });
    const m = await prisma.menu.create({
      data: {
        date: D(date),
        status: i <= 7 ? "PUBLISHED" : "DRAFT",
        publishedAt: i <= 7 ? at(add(date, -7), 9, 0) : null,
        nutriScore: pick<NutriScore>(["A", "B", "B", "C"]),
        dishes: { create: [dish("STARTER", starter), dish("MAIN", main), dish("DESSERT", dessert)] },
      },
    });
    menus.set(date, { id: m.id, appeal: main.appeal });
  }

  // Étudiants : historique de repas, rechargements et notes
  const created: string[] = [];
  for (const [idx, [firstName, lastName, allergens]] of STUDENTS.entries()) {
    const email = idx === 0 ? "etudiant@demo.cantine" : `${firstName.toLowerCase().normalize("NFD").replace(/[^a-z]/g, "")}.${lastName.toLowerCase().normalize("NFD").replace(/[^a-z]/g, "")}@demo.cantine`;
    const u = await prisma.user.create({
      data: {
        email,
        passwordHash: hash,
        firstName,
        lastName,
        role: "CONSUMER",
        status: "ACTIVE",
        tariffGroup: "STUDENT",
        requestedGroup: "STUDENT",
        memberRef: `VAT-2026-${String(101 + idx).padStart(4, "0")}`,
        allergens: [...allergens],
        reviewedAt: at(add(today, -20), 10, 0),
        createdAt: at(add(today, -21), 18, 0),
      },
    });
    created.push(u.id);
    let balance = 0;
    const topup = async (date: string, amount: number, method: "CASH" | "MOBILE_MONEY") => {
      balance += amount;
      await prisma.transaction.create({
        data: { userId: u.id, type: "TOPUP", method, amount, balanceAfter: balance, label: method === "CASH" ? "Rechargement au comptoir" : "Rechargement Wave", operatorId: method === "CASH" ? cashier.id : u.id, createdAt: at(date, 8, 15), note: method === "MOBILE_MONEY" ? "Réf. démo" : null },
      });
    };
    await topup(add(today, -17), idx === 0 ? 15000 : pick([10000, 15000, 20000]), idx % 3 === 0 ? "MOBILE_MONEY" : "CASH");

    for (let i = -16; i < 0; i++) {
      const date = add(today, i);
      const menu = menus.get(date);
      if (!menu || rand() > 0.72) continue;
      if (balance < PRICE) await topup(date, 10000, rand() > 0.5 ? "MOBILE_MONEY" : "CASH");
      const walkIn = rand() < 0.18;
      const servedAt = at(date, 11 + Math.floor(rand() * 3), Math.floor(rand() * 60));
      const r = await prisma.reservation.create({
        data: { userId: u.id, date: D(date), status: "SERVED", price: PRICE, walkIn, servedAt, servedById: cashier.id, createdAt: walkIn ? servedAt : at(add(date, -1), 19, 0) },
      });
      balance -= PRICE;
      await prisma.transaction.create({
        data: { userId: u.id, type: "MEAL", method: "WALLET", amount: -PRICE, balanceAfter: balance, label: walkIn ? "Repas du midi (sans réservation)" : "Repas du midi", reservationId: r.id, operatorId: cashier.id, createdAt: servedAt },
      });
      if (rand() < 0.6) {
        const score = Math.max(1, Math.min(5, Math.round(menu.appeal + (rand() - 0.5) * 2)));
        const comment = rand() < 0.35 && COMMENTS[score] ? pick(COMMENTS[score]) : null;
        await prisma.rating.create({ data: { reservationId: r.id, userId: u.id, menuId: menu.id, score, comment, createdAt: at(date, 14, 0) } });
      }
    }
    // L'étudiante principale de la démo garde un solde confortable ; une autre est sous le seuil
    if (idx === 0 && balance < 6000) await topup(add(today, -1), 10000, "MOBILE_MONEY");
    if (idx === 3) {
      while (balance >= 1500) {
        balance -= 1000;
        await prisma.transaction.create({ data: { userId: u.id, type: "ADJUSTMENT", method: "ADMIN", amount: -1000, balanceAfter: balance, label: "Correction administrative", note: "Démo : remboursement d'un trop-perçu", createdAt: at(add(today, -1), 16, 0) } });
      }
    }
    // Réservations à venir
    let committed = 0;
    for (let i = 0; i <= 4; i++) {
      const date = add(today, i);
      if (!menus.has(date) || (idx !== 0 && rand() > 0.6) || (idx === 0 && i > 2)) continue;
      if (committed + PRICE > balance) break;
      committed += PRICE;
      await prisma.reservation.create({ data: { userId: u.id, date: D(date), status: "RESERVED", price: PRICE, createdAt: at(add(today, -1), 20, 0) } });
    }
    await prisma.user.update({ where: { id: u.id }, data: { balance } });
  }

  // Inscription en attente de validation
  await prisma.user.create({
    data: { email: "nouveau@demo.cantine", passwordHash: hash, firstName: "Didier", lastName: "Gnagne", role: "CONSUMER", status: "PENDING", tariffGroup: "STUDENT", requestedGroup: "STUDENT", memberRef: "VAT-2026-0187" },
  });

  // Parent associé à l'étudiante principale
  const parent = await prisma.user.create({ data: { email: "parent@demo.cantine", passwordHash: hash, firstName: "Marie", lastName: "Kouassi", role: "PARENT", status: "ACTIVE", phone: "0708091011" } });
  await prisma.parentLink.create({ data: { parentId: parent.id, childId: created[0], createdAt: at(add(today, -10), 20, 0) } });
  const lastMeals = await prisma.reservation.findMany({ where: { userId: created[0], status: "SERVED" }, orderBy: { date: "desc" }, take: 2 });
  for (const m of lastMeals) {
    const menu = await prisma.menu.findUnique({ where: { date: m.date }, include: { dishes: true } });
    await prisma.notification.create({
      data: { userId: parent.id, kind: "meal_served", title: "{child} a déjeuné", body: "{dish} · {price:money} débités.", params: { child: "Aya", dish: menu?.dishes.find((d) => d.course === "MAIN")?.name ?? "", price: m.price }, href: "/famille", createdAt: m.servedAt ?? new Date(), readAt: m === lastMeals[1] ? new Date() : null },
    });
  }

  // Stock
  const stock = [
    ["Riz", "kg", 180, 50, 0],
    ["Attiéké", "kg", 40, 30, 0],
    ["Poulet", "kg", 22, 25, 0],
    ["Huile", "L", 35, 10, 0],
    ["Plateaux jetables", "u", 260, 100, 1],
  ] as const;
  for (const [name, unit, qty, minQty, perMeal] of stock) {
    await prisma.stockItem.upsert({ where: { name }, update: {}, create: { name, unit, qty, minQty, perMeal } });
  }

  console.log(`[demo] Données chargées. Mot de passe de tous les comptes de démonstration : ${PASSWORD}`);
  console.log("[demo]   etudiant@demo.cantine · parent@demo.cantine · caisse@demo.cantine · chef@demo.cantine · nouveau@demo.cantine (en attente)");
}

main()
  .catch((e) => {
    console.error("[demo] Échec :", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
