"use server";

import { revalidatePath } from "next/cache";
import type { Role } from "@prisma/client";
import { currentActor } from "@/server/actor";
import { msg, run } from "@/server/errors";
import { adjustBalance, approveUser, createStaff, rejectUser, resetPassword, setSuspended, updateSettings, type settingsSchema } from "@/server/services/admin";
import type { z } from "zod";

const refresh = () => revalidatePath("/admin", "layout");

export async function approveAction(userId: string) {
  return run(async () => {
    await approveUser(await currentActor(), userId);
    refresh();
  }, "Le compte est actif.");
}

export async function rejectAction(userId: string, note: string) {
  return run(async () => {
    await rejectUser(await currentActor(), userId, note);
    refresh();
  }, "L'usager verra le motif à sa prochaine connexion.");
}

export async function suspendAction(userId: string, suspended: boolean) {
  return run(async () => {
    await setSuspended(await currentActor(), userId, suspended);
    refresh();
  }, suspended ? "Compte suspendu, sessions fermées." : "Compte réactivé.");
}

export async function createStaffAction(input: { email: string; firstName: string; lastName: string; role: Role }) {
  return run(async () => {
    const r = await createStaff(await currentActor(), input);
    refresh();
    return { password: r.password, email: r.user.email };
  });
}

export async function resetPasswordAction(userId: string) {
  return run(async () => {
    const r = await resetPassword(await currentActor(), userId);
    refresh();
    return r.password;
  });
}

export async function adjustBalanceAction(userId: string, amount: number, reason: string) {
  return run(
    async () => {
      const r = await adjustBalance(await currentActor(), userId, amount, reason);
      refresh();
      return r.balance;
    },
    (balance) => msg("Nouveau solde : {balance:money}", { balance }),
  );
}

export async function updateSettingsAction(input: z.infer<typeof settingsSchema>) {
  return run(async () => {
    await updateSettings(await currentActor(), input);
    refresh();
    revalidatePath("/espace", "layout");
  }, "Appliqués immédiatement.");
}
