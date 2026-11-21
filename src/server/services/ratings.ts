import "server-only";
import { z } from "zod";
import { addDays, dateToIso, isoToDate } from "@/lib/utils";
import { prisma } from "../db";
import { AppError } from "../errors";
import { clock } from "../time";
import { type Actor, assertRole } from "./common";

/** Un repas se note dans les 7 jours qui suivent le passage en caisse */
export const RATING_WINDOW_DAYS = 7;

const ratingSchema = z.object({
  score: z.number().int().min(1, "Choisissez une note de 1 à 5.").max(5, "Choisissez une note de 1 à 5."),
  comment: z.string().trim().max(280, "Commentaire limité à 280 caractères.").optional(),
});

export async function rateMeal(actor: Actor, reservationId: string, raw: z.infer<typeof ratingSchema>) {
  assertRole(actor, ["CONSUMER"]);
  const input = ratingSchema.parse(raw);
  const res = await prisma.reservation.findUnique({ where: { id: z.string().min(1).parse(reservationId) } });
  if (!res || res.userId !== actor.id) throw new AppError("Repas introuvable.", "NOT_FOUND");
  if (res.status !== "SERVED") throw new AppError("Seul un repas servi peut être noté.", "NOT_SERVED");
  if (dateToIso(res.date) < addDays(clock().today, -RATING_WINDOW_DAYS)) throw new AppError("Ce repas ne peut plus être noté.", "TOO_LATE");
  const menu = await prisma.menu.findUnique({ where: { date: res.date } });
  if (!menu) throw new AppError("Menu introuvable.", "NOT_FOUND");
  const data = { score: input.score, comment: input.comment || null };
  return prisma.rating.upsert({
    where: { reservationId: res.id },
    update: data,
    create: { ...data, reservationId: res.id, userId: actor.id, menuId: menu.id },
  });
}

/** Satisfaction sur 30 jours : moyenne, répartition, menus les mieux et moins bien notés, derniers avis */
export async function ratingsSummary(actor: Actor) {
  assertRole(actor, ["CHEF", "ADMIN"]);
  const since = isoToDate(addDays(clock().today, -30));
  const ratings = await prisma.rating.findMany({
    where: { menu: { date: { gte: since } } },
    include: { menu: { include: { dishes: true } } },
    orderBy: { createdAt: "desc" },
  });
  const distribution = [1, 2, 3, 4, 5].map((s) => ratings.filter((r) => r.score === s).length);
  const byMenu = new Map<string, { date: string; main: string; total: number; count: number }>();
  for (const r of ratings) {
    const e = byMenu.get(r.menuId) ?? { date: dateToIso(r.menu.date), main: r.menu.dishes.find((d) => d.course === "MAIN")?.name ?? "—", total: 0, count: 0 };
    e.total += r.score;
    e.count += 1;
    byMenu.set(r.menuId, e);
  }
  const menus = [...byMenu.values()].map((m) => ({ ...m, average: m.total / m.count })).sort((a, b) => b.average - a.average || b.count - a.count);
  return {
    count: ratings.length,
    average: ratings.length ? ratings.reduce((s, r) => s + r.score, 0) / ratings.length : null,
    distribution,
    best: menus.slice(0, 3),
    worst: menus.length > 3 ? menus.slice(-2).reverse() : [],
    comments: ratings
      .filter((r) => r.comment)
      .slice(0, 6)
      .map((r) => ({ id: r.id, score: r.score, comment: r.comment!, date: dateToIso(r.menu.date) })),
  };
}
