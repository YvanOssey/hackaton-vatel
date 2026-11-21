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
