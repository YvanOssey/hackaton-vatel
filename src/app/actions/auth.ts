"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ROLES } from "@/lib/constants";
import { createSession, destroySession, getCurrentUser } from "@/server/auth";
import { AppError, run } from "@/server/errors";
import { authenticate, changePassword, register, type RegisterInput } from "@/server/services/account";

export async function loginAction(email: string, password: string) {
  const res = await run(async () => {
    const user = await authenticate(email, password);
    await createSession(user.id, (await headers()).get("user-agent"));
    return user.mustChangePassword ? "/mot-de-passe" : ROLES[user.role].home;
  });
  if (res.ok) redirect(res.data);
  return res;
}

export async function registerAction(input: RegisterInput) {
  const res = await run(async () => {
    const user = await register(input);
    await createSession(user.id, (await headers()).get("user-agent"));
    return ROLES[user.role].home;
  });
  if (res.ok) redirect(res.data);
  return res;
}

export async function logoutAction() {
  await destroySession();
  redirect("/connexion");
}

export async function changePasswordAction(current: string, next: string) {
  const res = await run(async () => {
    const user = await getCurrentUser();
    if (!user) throw new AppError("Session expirée, reconnectez-vous.", "UNAUTHENTICATED");
    await changePassword(user, current, next);
    return ROLES[user.role].home;
  });
  if (res.ok) redirect(res.data);
  return res;
}
