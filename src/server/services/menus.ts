import "server-only";
import { z } from "zod";
import { ALLERGEN_IDS } from "@/lib/constants";
import { isIsoDate, isoToDate } from "@/lib/utils";
import { prisma } from "../db";
import { AppError } from "../errors";
import { audit } from "../audit";
import { clock } from "../time";
import { type Actor, assertRole } from "./common";
import { announceMenu } from "./favorites";

const KITCHEN = ["CHEF", "ADMIN"] as const;

const dishSchema = z.object({
  name: z.string().trim().min(2, "Nom de plat trop court.").max(120, "Nom de plat trop long."),
  allergens: z.array(z.enum(ALLERGEN_IDS as [string, ...string[]])).max(14),
  kcal: z.number().int().min(0).max(5000),
  vegetarian: z.boolean(),
});

export const menuInput = z.object({
  date: z.string().refine(isIsoDate, "Date invalide."),
  nutriScore: z.enum(["A", "B", "C", "D", "E"]),
  starter: dishSchema,
  main: dishSchema,
  dessert: dishSchema,
  publish: z.boolean(),
});
export type MenuInput = z.infer<typeof menuInput>;

async function activeReservations(menuDate: Date) {
  return prisma.reservation.count({ where: { date: menuDate, status: { in: ["RESERVED", "SERVED"] } } });
}

export async function saveMenu(actor: Actor, raw: MenuInput) {
  assertRole(actor, [...KITCHEN]);
  const input = menuInput.parse(raw);
  if (input.date < clock().today) throw new AppError("Impossible de modifier le menu d'un jour passé.", "PAST");
  const date = isoToDate(input.date);
  const existing = await prisma.menu.findUnique({ where: { date } });
  if (existing?.status === "PUBLISHED" && !input.publish && (await activeReservations(date)) > 0) {
    throw new AppError("Ce menu a des réservations : il ne peut pas repasser en brouillon.", "HAS_RESERVATIONS");
  }
  return prisma.$transaction(async (tx) => {
    const menu = await tx.menu.upsert({
      where: { date },
      update: {
        nutriScore: input.nutriScore,
        status: input.publish ? "PUBLISHED" : "DRAFT",
        publishedAt: input.publish ? (existing?.publishedAt ?? new Date()) : null,
      },
      create: { date, nutriScore: input.nutriScore, status: input.publish ? "PUBLISHED" : "DRAFT", publishedAt: input.publish ? new Date() : null },
    });
    for (const [course, dish] of [["STARTER", input.starter], ["MAIN", input.main], ["DESSERT", input.dessert]] as const) {
      await tx.dish.upsert({
        where: { menuId_course: { menuId: menu.id, course } },
        update: dish,
        create: { ...dish, course, menuId: menu.id },
      });
    }
    // Passage de brouillon à publié : les étudiants sont prévenus (une seule fois, pas à chaque correction)
    if (input.publish && existing?.status !== "PUBLISHED") {
      await announceMenu(tx, input.date, [
        { course: "STARTER", name: input.starter.name },
        { course: "MAIN", name: input.main.name },
        { course: "DESSERT", name: input.dessert.name },
      ]);
    }
    await audit(tx, actor.id, input.publish ? "menu.publish" : "menu.save_draft", { type: "Menu", id: menu.id }, { date: input.date });
    return menu;
  });
}

export async function setMenuPublished(actor: Actor, menuId: string, publish: boolean) {
  assertRole(actor, [...KITCHEN]);
  const menu = await prisma.menu.findUnique({ where: { id: menuId } });
  if (!menu) throw new AppError("Menu introuvable.", "NOT_FOUND");
  if (menu.date.toISOString().slice(0, 10) < clock().today) throw new AppError("Menu d'un jour passé : non modifiable.", "PAST");
  if (!publish && (await activeReservations(menu.date)) > 0) {
    throw new AppError("Des usagers ont réservé ce menu : il ne peut pas être dépublié.", "HAS_RESERVATIONS");
  }
  await prisma.$transaction(async (tx) => {
    await tx.menu.update({ where: { id: menuId }, data: { status: publish ? "PUBLISHED" : "DRAFT", publishedAt: publish ? new Date() : null } });
    if (publish && menu.status !== "PUBLISHED") {
      const dishes = await tx.dish.findMany({ where: { menuId }, select: { course: true, name: true } });
      await announceMenu(tx, menu.date.toISOString().slice(0, 10), dishes);
    }
    await audit(tx, actor.id, publish ? "menu.publish" : "menu.unpublish", { type: "Menu", id: menuId });
  });
}

export async function deleteMenu(actor: Actor, menuId: string) {
  assertRole(actor, [...KITCHEN]);
  const menu = await prisma.menu.findUnique({ where: { id: menuId } });
  if (!menu) throw new AppError("Menu introuvable.", "NOT_FOUND");
  if (menu.date.toISOString().slice(0, 10) < clock().today) throw new AppError("Menu d'un jour passé : conservé pour l'historique.", "PAST");
  if ((await prisma.reservation.count({ where: { date: menu.date } })) > 0) {
    throw new AppError("Ce menu a des réservations (même annulées) : dépubliez-le plutôt que de le supprimer.", "HAS_RESERVATIONS");
  }
  await prisma.$transaction(async (tx) => {
    await tx.menu.delete({ where: { id: menuId } });
    await tx.menuPhoto.deleteMany({ where: { date: menu.date } });
    await audit(tx, actor.id, "menu.delete", { type: "Menu", id: menuId });
  });
}

// ─── Stock ────────────────────────────────────────────────────────────────

const stockSchema = z.object({
  name: z.string().trim().min(2).max(80),
  unit: z.string().trim().min(1).max(10),
  qty: z.number().int().min(0).max(1_000_000),
  minQty: z.number().int().min(0).max(1_000_000),
  perMeal: z.number().int().min(0).max(100),
});

export async function createStockItem(actor: Actor, raw: z.infer<typeof stockSchema>) {
  assertRole(actor, [...KITCHEN]);
  const data = stockSchema.parse(raw);
  if (await prisma.stockItem.findUnique({ where: { name: data.name } })) throw new AppError("Un article porte déjà ce nom.", "DUPLICATE");
  return prisma.stockItem.create({ data });
}

export async function adjustStock(actor: Actor, itemId: string, delta: number) {
  assertRole(actor, [...KITCHEN]);
  const d = z.number().int().min(-1_000_000).max(1_000_000).refine((n) => n !== 0, "Quantité nulle.").parse(delta);
  const item = await prisma.stockItem.findUnique({ where: { id: itemId } });
  if (!item) throw new AppError("Article introuvable.", "NOT_FOUND");
  if (item.qty + d < 0) throw new AppError("Le stock ne peut pas devenir négatif.", "NEGATIVE");
  return prisma.$transaction(async (tx) => {
    const updated = await tx.stockItem.update({ where: { id: itemId }, data: { qty: { increment: d } } });
    await audit(tx, actor.id, "stock.adjust", { type: "StockItem", id: itemId }, { delta: d, qty: updated.qty });
    return updated;
  });
}
