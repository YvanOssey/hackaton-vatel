export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

/** "YYYY-MM-DD" -> Date UTC minuit (sert aux colonnes @db.Date et aux calculs de jours) */
export const isoToDate = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
export const dateToIso = (d: Date) => d.toISOString().slice(0, 10);

export function addDays(iso: string, n: number) {
  const d = isoToDate(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return dateToIso(d);
}

/** Lundi de la semaine contenant la date */
export function mondayOf(iso: string) {
  const dow = (isoToDate(iso).getUTCDay() + 6) % 7;
  return addDays(iso, -dow);
}

export function weekDays(mondayIso: string, count = 5) {
  return Array.from({ length: count }, (_, i) => addDays(mondayIso, i));
}

export const isIsoDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(isoToDate(s).getTime()) && dateToIso(isoToDate(s)) === s;

export function formatDay(iso: string, opts: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long" }) {
  const s = isoToDate(iso).toLocaleDateString("fr-FR", { ...opts, timeZone: "UTC" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Date au fil d'une phrase : « Service du mercredi 18 novembre » */
export function formatDayInline(iso: string, opts?: Intl.DateTimeFormatOptions) {
  const s = formatDay(iso, opts);
  return s.charAt(0).toLowerCase() + s.slice(1);
}

export function formatTime(date: Date | string, timeZone?: string) {
  return new Date(date).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone });
}

export function formatDateTime(date: Date | string, timeZone?: string) {
  return new Date(date).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone });
}

export function initials(first: string, last: string) {
  return ((first[0] ?? "") + (last[0] ?? "")).toUpperCase();
}

/** Couleur d'avatar stable dérivée de l'identifiant */
// Teintes de la charte Vatel (noir et bleus profonds) : texte blanc lisible sur chacune
const AVATAR_COLORS = ["#1d1d1b", "#1f6fa8", "#1c5a89", "#1b4a70", "#475569", "#2b2b29", "#334155"];
export function avatarColor(id: string) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export function normalize(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

/** Délai d'animation échelonnée : style={delay(120)} avec les classes .anim-rise / .anim-fade */
export const delay = (ms: number) => ({ "--d": `${ms}ms` }) as React.CSSProperties;

/** Élision française devant un prénom : « d'Aya », « qu'Inès », « d'Hélène » (h muet, cas courant des prénoms) */
export const elides = (name: string) => /^[aeiouyhàâäéèêëîïôöùûüœæ]/i.test(name.trim());
