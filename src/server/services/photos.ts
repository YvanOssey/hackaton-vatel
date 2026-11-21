import "server-only";
import { z } from "zod";
import type { Course } from "@prisma/client";
import { MAX_PHOTO_BYTES, type PhotoType, dishPhotoUrl, photoKey } from "@/lib/photos";
import { dateToIso, isIsoDate, isoToDate } from "@/lib/utils";
import { prisma } from "../db";
import { AppError } from "../errors";
import { audit } from "../audit";
import { clock } from "../time";
import { type Actor, assertRole } from "./common";

const KITCHEN = ["CHEF", "ADMIN"] as const;

const target = z.object({
  date: z.string().refine(isIsoDate, "Date invalide."),
  course: z.enum(["STARTER", "MAIN", "DESSERT"]),
});

/** Reconnaît le format réel à partir des premiers octets (le type annoncé par le navigateur n'est pas fiable) */
export function sniffImage(bytes: Uint8Array): PhotoType | null {
  const b = bytes;
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return "image/png";
  const ascii = (from: number, to: number) => String.fromCharCode(...b.subarray(from, to));
  if (b.length > 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  return null;
}

function checkTarget(raw: { date: string; course: string }) {
  const { date, course } = target.parse(raw);
  if (date < clock().today) throw new AppError("Impossible de modifier la photo d'un jour passé.", "PAST");
  return { date, course: course as Course };
}

/** Ajoute ou remplace la photo d'un plat (cuisine et administration) */
export async function setMenuPhoto(actor: Actor, raw: { date: string; course: string }, bytes: Uint8Array) {
  assertRole(actor, [...KITCHEN]);
  const { date, course } = checkTarget(raw);
  if (bytes.length === 0) throw new AppError("Fichier vide : choisissez une photo.", "EMPTY");
  if (bytes.length > MAX_PHOTO_BYTES) throw new AppError("Photo trop lourde (1,5 Mo au plus) : choisissez une image plus petite.", "TOO_LARGE");
  const mime = sniffImage(bytes);
  if (!mime) throw new AppError("Format non pris en charge : utilisez une photo JPEG, PNG ou WebP.", "BAD_FORMAT");
  const data = Buffer.from(bytes);
  return prisma.$transaction(async (tx) => {
    const key = { date: isoToDate(date), course };
    const photo = await tx.menuPhoto.upsert({
      where: { date_course: key },
      update: { mime, data, size: data.length, updatedById: actor.id },
      create: { ...key, mime, data, size: data.length, updatedById: actor.id },
      select: { updatedAt: true },
    });
    await audit(tx, actor.id, "menu.photo_set", { type: "MenuPhoto", id: photoKey(date, course) }, { size: data.length, mime });
    return { url: dishPhotoUrl(date, course, photo.updatedAt.getTime()) };
  });
}

/** Retire la photo d'un plat */
export async function removeMenuPhoto(actor: Actor, raw: { date: string; course: string }) {
  assertRole(actor, [...KITCHEN]);
  const { date, course } = checkTarget(raw);
  await prisma.$transaction(async (tx) => {
    const { count } = await tx.menuPhoto.deleteMany({ where: { date: isoToDate(date), course } });
    if (count === 0) throw new AppError("Aucune photo à retirer pour ce plat.", "NOT_FOUND");
    await audit(tx, actor.id, "menu.photo_remove", { type: "MenuPhoto", id: photoKey(date, course) });
  });
}

/** Index des photos (sans les images) : « jour:plat » → adresse versionnée */
export async function photoIndex(dates: Date[]): Promise<Map<string, string>> {
  if (dates.length === 0) return new Map();
  const rows = await prisma.menuPhoto.findMany({ where: { date: { in: dates } }, select: { date: true, course: true, updatedAt: true } });
  return new Map(rows.map((r) => [photoKey(dateToIso(r.date), r.course), dishPhotoUrl(dateToIso(r.date), r.course, r.updatedAt.getTime())]));
}

/** Image servie aux comptes connectés */
export async function readMenuPhoto(date: string, course: string) {
  const parsed = target.safeParse({ date, course });
  if (!parsed.success) return null;
  return prisma.menuPhoto.findUnique({
    where: { date_course: { date: isoToDate(parsed.data.date), course: parsed.data.course } },
    select: { mime: true, data: true, updatedAt: true },
  });
}
