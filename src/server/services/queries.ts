import "server-only";
import type { AccountStatus, Prisma, Role } from "@prisma/client";
import { bookingState } from "@/lib/rules";
import { addDays, dateToIso, isIsoDate, isoToDate, mondayOf } from "@/lib/utils";
import { prisma } from "../db";
import { AppError } from "../errors";
import { passToken } from "../pass";
import { clock, dayRange } from "../time";
import { currentCashSession, sessionTotals } from "./cash";
import { photoIndex } from "./photos";
import { photoKey } from "@/lib/photos";
import { type Actor, assertRole, committedAmount, getSettings } from "./common";

const dishOrder = { STARTER: 0, MAIN: 1, DESSERT: 2 } as const;

/** Menu prêt à afficher : date ISO, plats dans l'ordre, adresse de la photo de chaque plat (ou null) */
type SerializedMenu<M extends { dishes: unknown[] }> = Omit<M, "date" | "dishes"> & { date: string; dishes: (M["dishes"][number] & { photo: string | null })[] };

function serializeMenu<M extends { date: Date; dishes: { course: keyof typeof dishOrder }[] }>(m: M, photos: Map<string, string> = new Map()): SerializedMenu<M> {
  const date = dateToIso(m.date);
  const dishes = [...m.dishes].sort((a, b) => dishOrder[a.course] - dishOrder[b.course]).map((d) => ({ ...d, photo: photos.get(photoKey(date, d.course)) ?? null }));
  return { ...m, date, dishes } as unknown as SerializedMenu<M>;
}

// ─── Usager ───────────────────────────────────────────────────────────────

export async function consumerOverview(actor: Actor) {
  assertRole(actor, ["CONSUMER"]);
  const now = clock();
  const monday = mondayOf(now.today);
  const from = isoToDate(monday);
  const to = isoToDate(addDays(monday, 13));
  const [user, settings, menus, reservations] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: actor.id } }),
    getSettings(prisma),
    prisma.menu.findMany({ where: { status: "PUBLISHED", date: { gte: from, lte: to } }, include: { dishes: true }, orderBy: { date: "asc" } }),
    prisma.reservation.findMany({ where: { userId: actor.id, date: { gte: from, lte: to }, status: { not: "CANCELLED" } }, include: { rating: true } }),
  ]);
  const [committed, photos, favorites] = await Promise.all([
    committedAmount(prisma, actor.id, now.today),
    photoIndex(menus.map((m) => m.date)),
    prisma.favoriteDish.findMany({ where: { userId: actor.id }, select: { key: true } }),
  ]);
  const days = Array.from({ length: 14 }, (_, i) => addDays(monday, i)).filter((d) => {
    const dow = isoToDate(d).getUTCDay();
    return (dow !== 0 && dow !== 6) || menus.some((m) => dateToIso(m.date) === d);
  });
  return {
    today: now.today,
    nowMinutes: now.minutes,
    settings: {
      cutoffTime: settings.cutoffTime,
      bookingHorizonDays: settings.bookingHorizonDays,
      lowBalanceThreshold: settings.lowBalanceThreshold,
      establishmentName: settings.establishmentName,
    },
    user: {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      status: user.status,
      tariffGroup: user.tariffGroup,
      balance: user.balance,
      allergens: user.allergens,
      phone: user.phone,
      email: user.email,
      memberRef: user.memberRef,
    },
    price: settings.priceStudent,
    committed,
    available: user.balance - committed,
    favoriteKeys: favorites.map((f) => f.key),
    days: days.map((date) => {
      const menu = menus.find((m) => dateToIso(m.date) === date);
      const res = reservations.find((r) => dateToIso(r.date) === date);
      return {
        date,
        menu: menu ? serializeMenu(menu, photos) : null,
        reservation: res ? { id: res.id, status: res.status, price: res.price, walkIn: res.walkIn, rating: res.rating ? { score: res.rating.score, comment: res.rating.comment } : null } : null,
        booking: bookingState(date, now, settings.cutoffTime, settings.bookingHorizonDays),
      };
    }),
  };
}

export async function consumerWallet(actor: Actor) {
  assertRole(actor, ["CONSUMER"]);
  const today = clock().today;
  const [user, transactions, committed, settings] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: actor.id } }),
    prisma.transaction.findMany({ where: { userId: actor.id }, orderBy: { createdAt: "desc" }, take: 100 }),
    committedAmount(prisma, actor.id, today),
    getSettings(prisma),
  ]);
  return {
    balance: user.balance,
    committed,
    available: user.balance - committed,
    lowBalanceThreshold: settings.lowBalanceThreshold,
    transactions: transactions.map((t) => ({ id: t.id, type: t.type, method: t.method, amount: t.amount, balanceAfter: t.balanceAfter, label: t.label, note: t.note, createdAt: t.createdAt.toISOString() })),
  };
}

export async function consumerPass(actor: Actor) {
  assertRole(actor, ["CONSUMER"]);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: actor.id } });
  return { token: user.status === "ACTIVE" ? passToken(user.id, user.passVersion) : null, user };
}

// ─── Parents ──────────────────────────────────────────────────────────────

export async function familyOverview(actor: Actor) {
  assertRole(actor, ["PARENT"]);
  const now = clock();
  const settings = await getSettings(prisma);
  const links = await prisma.parentLink.findMany({
    where: { parentId: actor.id },
    include: { child: { select: { id: true, firstName: true, lastName: true, status: true, balance: true, allergens: true, memberRef: true } } },
    orderBy: { createdAt: "asc" },
  });
  const todayDate = isoToDate(now.today);
  const children = await Promise.all(
    links.map(async ({ child }) => {
      const [committed, upcoming, meals, transactions, todayMenu] = await Promise.all([
        committedAmount(prisma, child.id, now.today),
        prisma.reservation.findMany({ where: { userId: child.id, status: "RESERVED", date: { gte: todayDate } }, orderBy: { date: "asc" }, take: 10 }),
        prisma.reservation.findMany({ where: { userId: child.id, status: "SERVED" }, orderBy: { date: "desc" }, take: 8, include: { rating: true } }),
        prisma.transaction.findMany({ where: { userId: child.id }, orderBy: { createdAt: "desc" }, take: 8 }),
        prisma.menu.findUnique({ where: { date: todayDate }, include: { dishes: true } }),
      ]);
      const mealMenus = await prisma.menu.findMany({ where: { date: { in: meals.map((m) => m.date) } }, include: { dishes: true } });
      const [todayRes, photos] = await Promise.all([
        prisma.reservation.findUnique({ where: { userId_date: { userId: child.id, date: todayDate } } }),
        photoIndex([todayDate]),
      ]);
      return {
        ...child,
        committed,
        available: child.balance - committed,
        low: child.balance < settings.lowBalanceThreshold,
        today: {
          status: todayRes && todayRes.status !== "CANCELLED" ? todayRes.status : null,
          menu: todayMenu?.status === "PUBLISHED" ? serializeMenu(todayMenu, photos) : null,
        },
        upcoming: upcoming.map((r) => ({ id: r.id, date: dateToIso(r.date), price: r.price })),
        meals: meals.map((m) => {
          const menu = mealMenus.find((x) => x.date.getTime() === m.date.getTime());
          return {
            id: m.id,
            date: dateToIso(m.date),
            price: m.price,
            walkIn: m.walkIn,
            dishes: menu ? serializeMenu(menu).dishes.map((d) => ({ course: d.course, name: d.name, vegetarian: d.vegetarian })) : [],
            rating: m.rating?.score ?? null,
          };
        }),
        transactions: transactions.map((t) => ({ id: t.id, type: t.type, method: t.method, amount: t.amount, label: t.label, createdAt: t.createdAt.toISOString() })),
      };
    }),
  );
  return { today: now.today, lowBalanceThreshold: settings.lowBalanceThreshold, price: settings.priceStudent, children };
}

// ─── Caisse ───────────────────────────────────────────────────────────────

export async function posState(actor: Actor) {
  assertRole(actor, ["CASHIER", "ADMIN"]);
  const now = clock();
  const session = await currentCashSession(prisma, actor.id);
  const date = isoToDate(now.today);
  const [menu, reservedCount, servedCount, photos] = await Promise.all([
    prisma.menu.findUnique({ where: { date }, include: { dishes: true } }),
    prisma.reservation.count({ where: { date, status: { in: ["RESERVED", "SERVED"] } } }),
    prisma.reservation.count({ where: { date, status: "SERVED" } }),
    photoIndex([date]),
  ]);
  if (!session) {
    return { today: now.today, session: null, menu: menu?.status === "PUBLISHED" ? serializeMenu(menu, photos) : null, reservedCount, servedCount, journal: [], totals: null };
  }
  const [journal, totals] = await Promise.all([
    prisma.transaction.findMany({
      where: { cashSessionId: session.id },
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: "desc" },
      take: 60,
    }),
    sessionTotals(prisma, session.id, session.openingFloat),
  ]);
  return {
    today: now.today,
    session: { id: session.id, openedAt: session.openedAt.toISOString(), openingFloat: session.openingFloat },
    menu: menu?.status === "PUBLISHED" ? serializeMenu(menu, photos) : null,
    reservedCount,
    servedCount,
    totals,
    journal: journal.map((t) => ({ id: t.id, type: t.type, method: t.method, amount: t.amount, label: t.label, createdAt: t.createdAt.toISOString(), user: t.user })),
  };
}

// ─── Cuisine ──────────────────────────────────────────────────────────────

export async function kitchenOverview(actor: Actor) {
  assertRole(actor, ["CHEF", "ADMIN"]);
  const now = clock();
  const monday = mondayOf(now.today);
  const from = isoToDate(monday);
  const to = isoToDate(addDays(monday, 13));
  const history = isoToDate(addDays(monday, -28));
  const [menus, counts, todayOrders, stock, walkIns, photos] = await Promise.all([
    prisma.menu.findMany({ where: { date: { gte: from, lte: to } }, include: { dishes: true }, orderBy: { date: "asc" } }),
    prisma.reservation.groupBy({ by: ["date", "status"], where: { date: { gte: from, lte: to }, status: { in: ["RESERVED", "SERVED"] } }, _count: true }),
    prisma.reservation.findMany({
      where: { date: isoToDate(now.today), status: { in: ["RESERVED", "SERVED"] } },
      select: { id: true, status: true, walkIn: true, servedAt: true, allergenOverride: true, user: { select: { id: true, firstName: true, lastName: true, allergens: true, memberRef: true } } },
      orderBy: [{ status: "asc" }, { user: { lastName: "asc" } }],
    }),
    prisma.stockItem.findMany({ orderBy: { name: "asc" } }),
    // Historique des passages sans réservation (4 semaines) pour estimer la production
    prisma.reservation.groupBy({ by: ["date", "walkIn"], where: { date: { gte: history, lt: isoToDate(now.today) }, status: "SERVED" }, _count: true }),
    // Photos des 14 jours, même sans menu enregistré (le chef peut ajouter la photo d'abord)
    photoIndex(Array.from({ length: 14 }, (_, i) => isoToDate(addDays(monday, i)))),
  ]);
  const todayReservants = todayOrders;
  const allergenCounts: Record<string, number> = {};
  for (const r of todayReservants) for (const a of r.user.allergens) allergenCounts[a] = (allergenCounts[a] ?? 0) + 1;
  const days = Array.from({ length: 14 }, (_, i) => addDays(monday, i)).filter((d) => {
    const dow = isoToDate(d).getUTCDay();
    return dow !== 0 && dow !== 6;
  });
  return {
    today: now.today,
    menus: menus.map((m) => serializeMenu(m, photos)),
    photos: Object.fromEntries(photos),
    days: days.map((date) => {
      const c = counts.filter((x) => dateToIso(x.date) === date);
      const served = c.find((x) => x.status === "SERVED")?._count ?? 0;
      const reserved = c.find((x) => x.status === "RESERVED")?._count ?? 0;
      const total = served + reserved;
      // Prévision anti-gaspillage : réservations + moyenne des passages sans réservation le même jour de semaine
      // (moyenne calculée sur les seuls jours où la cantine a servi)
      const served4w = [1, 2, 3, 4].map((w) => addDays(date, -7 * w)).filter((d) => d < now.today && walkIns.some((x) => dateToIso(x.date) === d));
      const walkInAvg = served4w.length
        ? served4w.reduce((acc, d) => acc + (walkIns.find((x) => dateToIso(x.date) === d && x.walkIn)?._count ?? 0), 0) / served4w.length
        : 0;
      return { date, total, served, forecast: date < now.today ? total : total + Math.round(walkInAvg), walkInAvg: Math.round(walkInAvg * 10) / 10 };
    }),
    allergenCounts: Object.entries(allergenCounts).sort((a, b) => b[1] - a[1]),
    stock,
    orders: todayOrders.map((o) => ({
      id: o.id,
      status: o.status,
      walkIn: o.walkIn,
      servedAt: o.servedAt?.toISOString() ?? null,
      user: o.user,
    })),
  };
}

// ─── Administration ───────────────────────────────────────────────────────

export async function adminDashboard(actor: Actor) {
  assertRole(actor, ["ADMIN"]);
  const now = clock();
  const { start, end } = dayRange(now.today);
  const date = isoToDate(now.today);
  const settings = await getSettings(prisma);
  const trendFrom = isoToDate(addDays(now.today, -13));
  const [trendRows, ratingAgg, parents, onlineTopups] = await Promise.all([
    prisma.reservation.groupBy({ by: ["date", "walkIn"], where: { date: { gte: trendFrom, lte: date }, status: "SERVED" }, _count: true, _sum: { price: true } }),
    prisma.rating.aggregate({ where: { createdAt: { gte: new Date(Date.now() - 30 * 86_400_000) } }, _avg: { score: true }, _count: true }),
    prisma.user.count({ where: { role: "PARENT", status: "ACTIVE" } }),
    prisma.transaction.aggregate({ where: { method: "MOBILE_MONEY", createdAt: { gte: start, lt: end } }, _sum: { amount: true }, _count: true }),
  ]);
  const trend = Array.from({ length: 14 }, (_, i) => addDays(now.today, i - 13)).map((d) => {
    const rows = trendRows.filter((r) => dateToIso(r.date) === d);
    return {
      date: d,
      reserved: rows.find((r) => !r.walkIn)?._count ?? 0,
      walkIn: rows.find((r) => r.walkIn)?._count ?? 0,
      revenue: rows.reduce((acc, r) => acc + (r._sum.price ?? 0), 0),
    };
  });
  const [byStatus, txGroups, pending, lowBalance, stock, openSessions, todayMenu, photos] = await Promise.all([
    prisma.reservation.groupBy({ by: ["status"], where: { date }, _count: true }),
    prisma.transaction.groupBy({ by: ["type", "method"], where: { createdAt: { gte: start, lt: end } }, _sum: { amount: true }, _count: true }),
    prisma.user.count({ where: { status: "PENDING", role: "CONSUMER" } }),
    prisma.user.findMany({
      where: { role: "CONSUMER", status: "ACTIVE", balance: { lt: settings.lowBalanceThreshold } },
      select: { id: true, firstName: true, lastName: true, balance: true, memberRef: true },
      orderBy: { balance: "asc" },
      take: 50,
    }),
    prisma.stockItem.findMany(),
    prisma.cashSession.findMany({ where: { status: "OPEN" }, include: { cashier: { select: { firstName: true, lastName: true } } } }),
    prisma.menu.findUnique({ where: { date }, include: { dishes: true } }),
    photoIndex([date]),
  ]);
  const count = (s: string) => byStatus.find((b) => b.status === s)?._count ?? 0;
  const sum = (type: string, method?: string) =>
    txGroups.filter((g) => g.type === type && (!method || g.method === method)).reduce((acc, g) => acc + (g._sum.amount ?? 0), 0);
  return {
    today: now.today,
    reservations: { reserved: count("RESERVED"), served: count("SERVED"), cancelled: count("CANCELLED") },
    sales: Math.abs(sum("MEAL")),
    mealCount: txGroups.filter((g) => g.type === "MEAL").reduce((a, g) => a + g._count, 0),
    cashIn: sum("TOPUP", "CASH"),
    onlineIn: onlineTopups._sum.amount ?? 0,
    onlineCount: onlineTopups._count,
    trend,
    satisfaction: { average: ratingAgg._avg.score, count: ratingAgg._count },
    parents,
    adjustments: sum("ADJUSTMENT"),
    pending,
    lowBalance,
    lowBalanceThreshold: settings.lowBalanceThreshold,
    lowStock: stock.filter((s) => s.qty < s.minQty),
    openSessions: openSessions.map((s) => ({ id: s.id, openedAt: s.openedAt.toISOString(), cashier: s.cashier, openingFloat: s.openingFloat })),
    menu: todayMenu ? { status: todayMenu.status, dishes: serializeMenu(todayMenu, photos).dishes.map((x) => ({ course: x.course, name: x.name, photo: x.photo })) } : null,
  };
}

export async function listUsers(actor: Actor, filter: { status?: AccountStatus; role?: Role; q?: string }) {
  assertRole(actor, ["ADMIN"]);
  const where: Prisma.UserWhereInput = {};
  if (filter.status) where.status = filter.status;
  if (filter.role) where.role = filter.role;
  if (filter.q?.trim()) {
    const t = filter.q.trim().slice(0, 60);
    where.OR = [
      { firstName: { contains: t, mode: "insensitive" } },
      { lastName: { contains: t, mode: "insensitive" } },
      { email: { contains: t, mode: "insensitive" } },
      { memberRef: { contains: t, mode: "insensitive" } },
    ];
  }
  return prisma.user.findMany({
    where,
    select: {
      id: true, email: true, firstName: true, lastName: true, phone: true, role: true, status: true, tariffGroup: true,
      memberRef: true, balance: true, allergens: true, createdAt: true, reviewNote: true,
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 200,
  });
}

export async function userDetail(actor: Actor, userId: string) {
  assertRole(actor, ["ADMIN"]);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      transactions: { orderBy: { createdAt: "desc" }, take: 50, include: { operator: { select: { firstName: true, lastName: true } } } },
    },
  });
  if (!user) throw new AppError("Compte introuvable.", "NOT_FOUND");
  const { passwordHash: _omit, ...safe } = user;
  void _omit;
  return safe;
}

export async function listCashSessions(actor: Actor) {
  assertRole(actor, ["ADMIN"]);
  const sessions = await prisma.cashSession.findMany({
    include: { cashier: { select: { firstName: true, lastName: true } } },
    orderBy: { openedAt: "desc" },
    take: 100,
  });
  return Promise.all(sessions.map(async (s) => ({ ...s, totals: await sessionTotals(prisma, s.id, s.openingFloat) })));
}

export async function ledger(actor: Actor, from: string, to: string) {
  assertRole(actor, ["ADMIN"]);
  if (!isIsoDate(from) || !isIsoDate(to) || from > to) throw new AppError("Période invalide.");
  if (isoToDate(to).getTime() - isoToDate(from).getTime() > 366 * 86_400_000) throw new AppError("Période limitée à un an.");
  return prisma.transaction.findMany({
    where: { createdAt: { gte: dayRange(from).start, lt: dayRange(to).end } },
    include: {
      user: { select: { firstName: true, lastName: true, email: true, tariffGroup: true, memberRef: true } },
      operator: { select: { firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function auditTrail(actor: Actor) {
  assertRole(actor, ["ADMIN"]);
  return prisma.auditLog.findMany({
    include: { actor: { select: { firstName: true, lastName: true, role: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export async function adminSettings(actor: Actor) {
  assertRole(actor, ["ADMIN"]);
  const s = await getSettings(prisma);
  return {
    establishmentName: s.establishmentName,
    cutoffTime: s.cutoffTime,
    bookingHorizonDays: s.bookingHorizonDays,
    lowBalanceThreshold: s.lowBalanceThreshold,
    allowWalkIn: s.allowWalkIn,
    priceStudent: s.priceStudent,
  };
}
