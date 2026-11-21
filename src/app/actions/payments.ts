"use server";

import { revalidatePath } from "next/cache";
import type { MobileProvider } from "@prisma/client";
import { currentActor } from "@/server/actor";
import { msg, run } from "@/server/errors";
import { confirmTopUp, initiateTopUp } from "@/server/services/payments";

export async function initiateTopUpAction(input: { beneficiaryId: string; provider: MobileProvider; phone: string; amount: number }) {
  return run(async () => initiateTopUp(await currentActor(), input));
}

export async function confirmTopUpAction(intentId: string) {
  return run(
    async () => {
      const r = await confirmTopUp(await currentActor(), intentId);
      if (r.status === "SUCCEEDED") {
        revalidatePath("/espace", "layout");
        revalidatePath("/famille", "layout");
      }
      return r;
    },
    (r) => (r.status === "SUCCEEDED" && r.balance !== null ? msg("Nouveau solde : {balance:money}", { balance: r.balance }) : ""),
  );
}
