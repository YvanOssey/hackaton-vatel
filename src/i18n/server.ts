import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, pickLocale, type Locale } from "./config";
import { env } from "@/server/env";
import { createI18n } from "./core";

export const getLocale = cache(async (): Promise<Locale> => {
  try {
    const [c, h] = await Promise.all([cookies(), headers()]);
    return pickLocale(c.get(LOCALE_COOKIE)?.value, h.get("accept-language"));
  } catch {
    return DEFAULT_LOCALE; // hors requête (tests, scripts)
  }
});

export const getI18n = cache(async () => createI18n(await getLocale(), env.timezone));
