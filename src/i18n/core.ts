import { allergenLabel } from "@/lib/constants";
import { en } from "./en";
import type { Locale } from "./config";

export type Params = Record<string, string | number | null | undefined>;

const INTL: Record<Locale, string> = { fr: "fr-FR", en: "en-GB" };
const number = { fr: new Intl.NumberFormat("fr-FR"), en: new Intl.NumberFormat("en-GB") };

export const formatNumberIn = (locale: Locale, n: number) => number[locale].format(n).replace(/ | /g, " ");
/** Franc CFA sans décimales : « 1 500 FCFA » / « 1,500 FCFA » */
export const formatMoneyIn = (locale: Locale, n: number) => `${n < 0 ? "−" : ""}${formatNumberIn(locale, Math.abs(Math.round(n)))} FCFA`;

/**
 * Le français est la langue source : les clés du dictionnaire sont les textes français.
 * Interpolation : {name}, {amount:money}, {count:number}, {date:day} (date ISO → « lundi 23 novembre »).
 */
export function translate(locale: Locale, key: string, params?: Params) {
  const template = locale === "fr" ? key : (en[key] ?? key);
  if (!params) return template;
  return template.replace(/\{(\w+)(?::(money|number|day))?\}/g, (whole, name: string, kind?: string) => {
    const v = params[name];
    if (v === undefined || v === null) return "";
    if (kind === "day" && typeof v === "string") return new Date(`${v}T00:00:00.000Z`).toLocaleDateString(INTL[locale], { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
    if (typeof v === "number" && kind === "money") return formatMoneyIn(locale, v);
    if (typeof v === "number") return formatNumberIn(locale, v);
    return String(v);
  });
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const DAY_OPTS: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long" };

/** timeZone : fuseau de l'établissement, identique côté serveur et navigateur (pas d'écart d'hydratation) */
export function createI18n(locale: Locale, tz?: string) {
  const tag = INTL[locale];
  const day = (iso: string, opts: Intl.DateTimeFormatOptions = DAY_OPTS) => cap(new Date(`${iso}T00:00:00.000Z`).toLocaleDateString(tag, { ...opts, timeZone: "UTC" }));
  return {
    locale,
    tag,
    t: (key: string, params?: Params) => translate(locale, key, params),
    money: (n: number) => formatMoneyIn(locale, n),
    num: (n: number) => formatNumberIn(locale, n),
    /** Décimal à une décimale : « 4,2 » / « 4.2 » */
    dec: (n: number, digits = 1) => n.toLocaleString(tag, { minimumFractionDigits: digits, maximumFractionDigits: digits }),
    day,
    /** Au fil d'une phrase : minuscule en français (« le mercredi 18 »), majuscule en anglais */
    dayInline: (iso: string, opts?: Intl.DateTimeFormatOptions) => {
      const s = day(iso, opts);
      return locale === "fr" ? s.charAt(0).toLowerCase() + s.slice(1) : s;
    },
    /** Notes générées par l'application (« Payé par … · Réf. … ») ; le texte libre reste tel quel */
    note: (s: string) => {
      const allergen = /^Alerte allergène vérifiée : (.+)$/.exec(s);
      if (allergen) return `${translate(locale, "Alerte allergène vérifiée :")} ${allergen[1].split(", ").map((a) => translate(locale, allergenLabel(a))).join(", ")}`;
      return s.replace(/^Payé par /, `${translate(locale, "Payé par")} `).replace(/Réf\. /g, `${translate(locale, "Réf.")} `);
    },
    time: (d: Date | string, timeZone = tz) => new Date(d).toLocaleTimeString(tag, { hour: "2-digit", minute: "2-digit", timeZone }),
    dateTime: (d: Date | string, timeZone = tz) => new Date(d).toLocaleString(tag, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone }),
  };
}

export type I18n = ReturnType<typeof createI18n>;
