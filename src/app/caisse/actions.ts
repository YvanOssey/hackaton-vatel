"use server";

import { revalidatePath } from "next/cache";
import { currentActor } from "@/server/actor";
import { msg, run } from "@/server/errors";
import { closeCashSession, openCashSession } from "@/server/services/cash";
import { cashTopUp, getCustomer, lookupByPass, searchConsumers, serveMeal } from "@/server/services/pos";

export async function openSessionAction(openingFloat: number) {
  return run(async () => {
    await openCashSession(await currentActor(), openingFloat);
    revalidatePath("/caisse");
  }, "Bon service !");
}

export async function closeSessionAction(countedCash: number, note: string) {
  return run(
    async () => {
      const r = await closeCashSession(await currentActor(), countedCash, note);
      revalidatePath("/caisse");
      return r.session.difference ?? 0;
    },
    (diff) => (diff === 0 ? "Caisse juste." : msg("Écart enregistré : {sign}{diff:money}.", { sign: diff > 0 ? "+" : "", diff })),
  );
}

export async function scanAction(scanned: string) {
  return run(async () => lookupByPass(await currentActor(), scanned));
}

export async function searchAction(query: string) {
  return run(async () => searchConsumers(await currentActor(), query));
}

export async function customerAction(userId: string) {
  return run(async () => getCustomer(await currentActor(), userId));
}

export async function serveAction(userId: string, allergenAck: boolean) {
  return run(
    async () => {
      const r = await serveMeal(await currentActor(), userId, allergenAck);
      revalidatePath("/caisse");
      return r;
    },
    (r) => msg("{price:money} débités · nouveau solde {balance:money}", { price: r.price, balance: r.balance }),
  );
}

export async function cashTopUpAction(userId: string, amount: number) {
  return run(
    async () => {
      const r = await cashTopUp(await currentActor(), userId, amount);
      revalidatePath("/caisse");
      return r;
    },
    msg("{amount:money} encaissés en espèces.", { amount }),
  );
}
