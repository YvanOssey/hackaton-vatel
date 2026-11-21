import type { Clock } from "@/lib/rules";
import { env } from "./env";

/** Horloge de l'établissement (fuseau APP_TIMEZONE), indépendante du fuseau du serveur */
export function clock(now = new Date()): Clock {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: env.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  return { today: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

/** Décalage (minutes) entre l'heure locale de l'établissement et UTC à un instant donné */
function offsetMinutes(at: Date) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: env.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(at)
      .map((x) => [x.type, Number(x.value)]),
  );
  const wall = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  return Math.round((wall - Math.floor(at.getTime() / 60_000) * 60_000) / 60_000);
}

/** Bornes UTC [start, end[ d'une journée locale, pour filtrer les horodatages */
export function dayRange(iso: string) {
  const offset = offsetMinutes(new Date(`${iso}T12:00:00Z`));
  const start = new Date(Date.parse(`${iso}T00:00:00Z`) - offset * 60_000);
  return { start, end: new Date(start.getTime() + 86_400_000) };
}
