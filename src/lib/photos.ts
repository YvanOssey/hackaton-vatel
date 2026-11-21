import type { Course } from "@prisma/client";

/** Taille maximale d'une photo de plat après compression (identique à la contrainte SQL) */
export const MAX_PHOTO_BYTES = 1_572_864;

/** Formats acceptés : jamais de SVG (scriptable) */
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type PhotoType = (typeof PHOTO_TYPES)[number];

/** Adresse d'une photo de plat ; `v` change à chaque remplacement pour contourner le cache */
export function dishPhotoUrl(date: string, course: Course, version: number) {
  return `/api/photos/${date}/${course}?v=${version}`;
}

/** Clé d'index jour + plat */
export const photoKey = (date: string, course: Course) => `${date}:${course}`;
