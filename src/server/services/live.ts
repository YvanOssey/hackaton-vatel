import "server-only";
import { addDays, isoToDate } from "@/lib/utils";
import { affluence, minutesOf, pickupSlots, slotOf } from "@/lib/rules";
import { prisma } from "../db";
import { clock } from "../time";
import { getSettings } from "./common";

/**
 * File d'attente en direct (étudiants) : affluence des 10 dernières minutes, attente estimée,
 * et affluence habituelle par créneau (même jour de la semaine, 4 dernières semaines) pour conseiller l'heure de passage.
 * Aucune donnée personnelle : uniquement des comptes de passages.
 */
export async function liveService() {
  const now = clock();
  const settings = await getSettings(prisma);
  const slots = pickupSlots(settings.serviceStart, settings.serviceEnd);
  const history = [7, 14, 21, 28].map((d) => isoToDate(addDays(now.today, -d)));
  const tenMinutesAgo = new Date(Date.now() - 10 * 60_000);
  const [openCashiers, last10, reservedLeft, past] = await Promise.all([
    prisma.cashSession.count({ where: { status: "OPEN" } }),
    prisma.reservation.count({ where: { date: isoToDate(now.today), status: "SERVED", servedAt: { gte: tenMinutesAgo } } }),
    prisma.reservation.count({ where: { date: isoToDate(now.today), status: "RESERVED" } }),
    prisma.reservation.findMany({ where: { date: { in: history }, status: "SERVED", servedAt: { not: null } }, select: { servedAt: true } }),
  ]);
  // Passages habituels par créneau (moyenne sur les semaines où la cantine a servi)
  const weeks = new Set(past.map((p) => clock(p.servedAt!).today)).size || 1;
  const counts = new Map<string, number>();
  for (const p of past) {
    const slot = slotOf(clock(p.servedAt!).minutes);
    counts.set(slot, (counts.get(slot) ?? 0) + 1);
  }
  const profile = slots.map((slot) => ({ slot, usual: Math.round(((counts.get(slot) ?? 0) / weeks) * 10) / 10 }));
  const upcoming = profile.filter((p) => minutesOf(p.slot) + 15 > now.minutes);
  const best = past.length && upcoming.length ? upcoming.reduce((a, b) => (b.usual < a.usual ? b : a)).slot : null;
  const inService = now.minutes >= minutesOf(settings.serviceStart) && now.minutes < minutesOf(settings.serviceEnd);
  return {
    now: slotOf(now.minutes),
    inService,
    serviceStart: settings.serviceStart,
    serviceEnd: settings.serviceEnd,
    openCashiers,
    passagesLast10: last10,
    reservedLeft,
    ...affluence(last10, openCashiers),
    profile,
    best,
  };
}

export type LiveService = Awaited<ReturnType<typeof liveService>>;
