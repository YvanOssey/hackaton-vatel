"use server";

import { revalidatePath } from "next/cache";
import { currentActor } from "@/server/actor";
import { getI18n } from "@/i18n/server";
import { msg, run } from "@/server/errors";
import { regeneratePass, updateProfile } from "@/server/services/account";
import { createLinkCode, revokeLinkCode, unlink } from "@/server/services/family";
import { rateMeal } from "@/server/services/ratings";
import { cancelReservation, reserveMeal } from "@/server/services/reservations";

export async function reserveAction(date: string) {
  return run(
    async () => {
      const r = await reserveMeal(await currentActor(), date);
      revalidatePath("/espace", "layout");
      const { day, t } = await getI18n();
      return t("{day} · {price:money} engagés", { day: day(r.date), price: r.price });
    },
    (label) => label,
  );
}

export async function cancelAction(reservationId: string) {
  return run(
    async () => {
      const r = await cancelReservation(await currentActor(), reservationId);
      revalidatePath("/espace", "layout");
      return r.released;
    },
    (released) => msg("{amount:money} libérés sur votre solde.", { amount: released }),
  );
}

export async function updateProfileAction(input: { phone?: string; allergens: string[] }) {
  return run(async () => {
    await updateProfile(await currentActor(), input);
    revalidatePath("/espace", "layout");
  }, "Vos allergies seront signalées en caisse.");
}

export async function regeneratePassAction() {
  return run(async () => {
    await regeneratePass(await currentActor());
    revalidatePath("/espace/pass");
  }, "L'ancien QR Code ne fonctionne plus.");
}

export async function rateMealAction(reservationId: string, score: number, comment?: string) {
  return run(async () => {
    await rateMeal(await currentActor(), reservationId, { score, comment });
    revalidatePath("/espace", "layout");
  }, "Merci, la cuisine verra votre avis.");
}

export async function createLinkCodeAction() {
  return run(async () => {
    const r = await createLinkCode(await currentActor());
    revalidatePath("/espace/profil");
    return r;
  });
}

export async function revokeLinkCodeAction() {
  return run(async () => {
    await revokeLinkCode(await currentActor());
    revalidatePath("/espace/profil");
  }, "Le code ne peut plus être utilisé.");
}

export async function unlinkParentAction(parentId: string) {
  return run(async () => {
    await unlink(await currentActor(), parentId);
    revalidatePath("/espace/profil");
  }, "Ce parent ne suit plus votre compte.");
}
