import "server-only";
import { z } from "zod";
import { MAX_FAVORITES, dishKey, matchesFavorite } from "@/lib/dishes";
import { addDays, mondayOf } from "@/lib/utils";
import { clock } from "../time";
import { prisma, type Tx } from "../db";
import { AppError } from "../errors";
import { notify } from "../notify";
import { type Actor, assertRole } from "./common";

const nameSchema = z.string().trim().min(2, "Nom de plat trop court.").max(120, "Nom de plat trop long.");

/** Plats préférés de l'étudiant, du plus récent au plus ancien */
export async function listFavorites(actor: Actor) {
  assertRole(actor, ["CONSUMER"]);
  return prisma.favoriteDish.findMany({ where: { userId: actor.id }, select: { id: true, name: true, key: true }, orderBy: { createdAt: "desc" } });
}

/** Ajoute un plat préféré (sans doublon : « Poulet yassa » et « poulet Yassa » sont le même plat) */
export async function addFavorite(actor: Actor, rawName: string) {
  assertRole(actor, ["CONSUMER"]);
  const name = nameSchema.parse(rawName);
  const key = dishKey(name);
  if (!key) throw new AppError("Nom de plat trop court.", "VALIDATION");
  const existing = await prisma.favoriteDish.findUnique({ where: { userId_key: { userId: actor.id, key } } });
  if (existing) return existing;
  if ((await prisma.favoriteDish.count({ where: { userId: actor.id } })) >= MAX_FAVORITES) {
    throw new AppError("Vous avez déjà {max} plats préférés : retirez-en un pour en ajouter un autre.", "LIMIT", { max: MAX_FAVORITES });
  }
  return prisma.favoriteDish.create({ data: { userId: actor.id, name, key }, select: { id: true, name: true, key: true } });
}

/** Cœur d'un plat du menu : l'ajoute aux préférés, ou retire les préférés qui le désignent déjà */
export async function toggleFavoriteDish(actor: Actor, dishName: string) {
  assertRole(actor, ["CONSUMER"]);
  const name = nameSchema.parse(dishName);
  const mine = await prisma.favoriteDish.findMany({ where: { userId: actor.id }, select: { id: true, key: true } });
  const matching = mine.filter((f) => matchesFavorite(name, f.key));
  if (matching.length) {
    await prisma.favoriteDish.deleteMany({ where: { id: { in: matching.map((f) => f.id) }, userId: actor.id } });
    return { added: false, name };
  }
  await addFavorite(actor, name);
  return { added: true, name };
}

/** Retire un plat préféré (uniquement les siens) */
export async function removeFavorite(actor: Actor, id: string) {
  assertRole(actor, ["CONSUMER"]);
  const { count } = await prisma.favoriteDish.deleteMany({ where: { id: z.string().min(1).parse(id), userId: actor.id } });
  if (count === 0) throw new AppError("Ce plat n'est pas dans vos plats préférés.", "NOT_FOUND");
}

/**
 * Annonce d'un menu qui vient d'être publié (dans la transaction de publication) :
 * - les étudiants dont un plat préféré est au menu reçoivent une alerte dédiée ;
 * - les autres étudiants actifs reçoivent « Nouveau menu disponible ».
 */
export async function announceMenu(tx: Tx, date: string, dishes: { course: string; name: string }[]) {
  const [students, favorites] = await Promise.all([
    tx.user.findMany({ where: { role: "CONSUMER", status: "ACTIVE" }, select: { id: true } }),
    tx.favoriteDish.findMany({ where: { user: { role: "CONSUMER", status: "ACTIVE" } }, select: { userId: true, key: true } }),
  ]);
  // Lien vers la bonne semaine des menus de l'étudiant
  const href = date >= addDays(mondayOf(clock().today), 7) ? "/espace?semaine=prochaine" : "/espace";
  // Un seul message par étudiant : le premier de ses plats préférés trouvé dans le menu
  const fans = new Map<string, string>();
  for (const f of favorites) {
    if (fans.has(f.userId)) continue;
    const dish = dishes.find((d) => matchesFavorite(d.name, f.key));
    if (dish) fans.set(f.userId, dish.name);
  }
  const byDish = new Map<string, string[]>();
  for (const [userId, dish] of fans) byDish.set(dish, [...(byDish.get(dish) ?? []), userId]);
  for (const [dish, userIds] of byDish) {
    await notify(tx, userIds, {
      kind: "favorite",
      title: "Votre plat préféré est au menu",
      body: "{dish} sera servi le {date:day}. Réservez votre repas.",
      params: { dish, date },
      href,
    });
  }
  const main = dishes.find((d) => d.course === "MAIN")?.name ?? dishes[0]?.name ?? "";
  await notify(
    tx,
    students.map((s) => s.id).filter((id) => !fans.has(id)),
    { kind: "menu", title: "Nouveau menu disponible", body: "Le menu du {date:day} est publié : {main}.", params: { date, main }, href },
  );
  return { favorites: fans.size, students: students.length };
}
