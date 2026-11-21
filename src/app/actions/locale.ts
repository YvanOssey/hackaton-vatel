"use server";

import { cookies } from "next/headers";
import { isLocale, LOCALE_COOKIE, type Locale } from "@/i18n/config";
import { getCurrentUser } from "@/server/auth";
import { prisma } from "@/server/db";

export async function setLocaleAction(locale: Locale) {
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", httpOnly: false });
  // Langue des notifications push envoyées à cet usager
  const user = await getCurrentUser();
  if (user && user.locale !== locale) await prisma.user.update({ where: { id: user.id }, data: { locale } });
}
