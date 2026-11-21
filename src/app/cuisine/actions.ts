"use server";

import { revalidatePath } from "next/cache";
import { currentActor } from "@/server/actor";
import { msg, run } from "@/server/errors";
import { adjustStock, createStockItem, deleteMenu, saveMenu, setMenuPublished, type MenuInput } from "@/server/services/menus";
import { removeMenuPhoto, setMenuPhoto } from "@/server/services/photos";
import { AppError } from "@/server/errors";

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

/** Photo d'un plat : le fichier arrive déjà compressé par le navigateur (voir src/lib/image.ts) */
export async function uploadDishPhotoAction(form: FormData) {
  return run(async () => {
    const file = form.get("photo");
    if (!(file instanceof Blob)) throw new AppError("Fichier vide : choisissez une photo.", "EMPTY");
    const res = await setMenuPhoto(await currentActor(), { date: String(form.get("date") ?? ""), course: String(form.get("course") ?? "") }, new Uint8Array(await file.arrayBuffer()));
    refresh();
    return res;
  }, "Photo enregistrée.");
}

export async function removeDishPhotoAction(date: string, course: string) {
  return run(async () => {
    await removeMenuPhoto(await currentActor(), { date, course });
    refresh();
  }, "Photo retirée.");
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
