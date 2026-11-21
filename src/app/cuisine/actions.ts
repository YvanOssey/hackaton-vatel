"use server";

import { revalidatePath } from "next/cache";
import { currentActor } from "@/server/actor";
import { msg, run } from "@/server/errors";
import { adjustStock, createStockItem, deleteMenu, saveMenu, setMenuPublished, type MenuInput } from "@/server/services/menus";

const refresh = () => {
  revalidatePath("/cuisine", "layout");
  revalidatePath("/espace", "layout");
};

export async function saveMenuAction(input: MenuInput) {
  return run(async () => {
    await saveMenu(await currentActor(), input);
    refresh();
  }, input.publish ? "Le menu est visible par les usagers." : "Brouillon enregistré, non visible par les usagers.");
}

export async function setPublishedAction(menuId: string, publish: boolean) {
  return run(async () => {
    await setMenuPublished(await currentActor(), menuId, publish);
    refresh();
  }, publish ? "Menu publié." : "Menu repassé en brouillon.");
}

export async function deleteMenuAction(menuId: string) {
  return run(async () => {
    await deleteMenu(await currentActor(), menuId);
    refresh();
  }, "Menu supprimé.");
}

export async function createStockAction(input: { name: string; unit: string; qty: number; minQty: number; perMeal: number }) {
  return run(async () => {
    await createStockItem(await currentActor(), input);
    revalidatePath("/cuisine", "layout");
  }, "Article ajouté.");
}

export async function adjustStockAction(itemId: string, delta: number) {
  return run(
    async () => {
      const item = await adjustStock(await currentActor(), itemId, delta);
      revalidatePath("/cuisine", "layout");
      revalidatePath("/admin");
      return item;
    },
    (item) => msg("{name} : {qty} {unit}", { name: item.name, qty: item.qty, unit: item.unit }),
  );
}
