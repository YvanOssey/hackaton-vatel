export const LOCALES = ["fr", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "fr";
export const LOCALE_COOKIE = "cc_lang";
export const isLocale = (v: unknown): v is Locale => typeof v === "string" && (LOCALES as readonly string[]).includes(v);

/** Choix initial : cookie, sinon en-tête Accept-Language, sinon français */
export function pickLocale(cookie: string | undefined, acceptLanguage: string | null | undefined): Locale {
  if (isLocale(cookie)) return cookie;
  for (const part of (acceptLanguage ?? "").split(",")) {
    const tag = part.split(";")[0].trim().slice(0, 2).toLowerCase();
    if (isLocale(tag)) return tag;
  }
  return DEFAULT_LOCALE;
}
