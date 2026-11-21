/**
 * Règles métier pures (sans accès base) partagées entre le serveur et l'interface.
 * Le serveur reste la seule source de vérité : l'interface ne s'en sert que pour l'affichage.
 */
import { addDays } from "./utils";

export interface Clock {
  /** Date du jour dans le fuseau de l'établissement (YYYY-MM-DD) */
  today: string;
  /** Minutes écoulées depuis minuit dans ce fuseau */
  minutes: number;
}

/** Établissement réservé aux étudiants : un seul tarif de repas */
export function mealPrice(settings: { priceStudent: number }) {
  return settings.priceStudent;
}

export function minutesOf(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
}

export const isTime = (s: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s);

export type BookingState = { open: true } | { open: false; reason: string; params?: Record<string, string | number> };

/** Réservation et annulation : jour non passé, dans l'horizon, avant l'heure limite le jour même */
export function bookingState(date: string, clock: Clock, cutoff: string, horizonDays: number): BookingState {
  if (date < clock.today) return { open: false, reason: "Ce jour est passé." };
  if (date > addDays(clock.today, horizonDays)) return { open: false, reason: "Réservations ouvertes {days} jours à l'avance.", params: { days: horizonDays } };
  if (date === clock.today && clock.minutes >= minutesOf(cutoff)) {
    return { open: false, reason: "Heure limite dépassée ({time}).", params: { time: cutoff } };
  }
  return { open: true };
}

export function allergenConflicts(userAllergens: string[], dishAllergens: string[][]) {
  const all = new Set(dishAllergens.flat());
  return userAllergens.filter((a) => all.has(a));
}

// ─── Service du midi : créneaux de retrait et affluence ─────────────────────

/** Durée d'un créneau de retrait (minutes) */
export const PICKUP_SLOT_MINUTES = 15;

const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** Créneaux de 15 min entre le début (inclus) et la fin (exclue) du service : « 11:30 », « 11:45 »… */
export function pickupSlots(start: string, end: string) {
  const out: string[] = [];
  for (let m = minutesOf(start); m + PICKUP_SLOT_MINUTES <= minutesOf(end); m += PICKUP_SLOT_MINUTES) out.push(hhmm(m));
  return out;
}

/** Créneau (début) contenant une heure donnée, en minutes depuis minuit */
export const slotOf = (minutes: number) => hhmm(Math.floor(minutes / PICKUP_SLOT_MINUTES) * PICKUP_SLOT_MINUTES);

/** Secondes passées en caisse par usager (scan, validation) : sert à estimer l'attente */
export const SECONDS_PER_PASSAGE = 20;

/**
 * Affluence d'après les passages des 10 dernières minutes et le nombre de caisses ouvertes.
 * Attente estimée = passages par caisse × durée moyenne d'un passage, plafonnée à 30 min (estimation affichée « ≈ »).
 */
export function affluence(passagesLast10: number, openCashiers: number) {
  if (openCashiers <= 0) return { level: "closed" as const, waitMinutes: null };
  const perCashier = passagesLast10 / openCashiers;
  const level = perCashier < 5 ? ("calm" as const) : perCashier < 15 ? ("busy" as const) : ("rush" as const);
  const waitMinutes = Math.min(30, Math.round((perCashier * SECONDS_PER_PASSAGE) / 60));
  return { level, waitMinutes };
}
