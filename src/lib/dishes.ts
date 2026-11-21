/**
 * Reconnaissance des plats saisis librement par la cuisine (plats préférés des étudiants).
 * « Poulet Yassa » retrouve « Poulet yassa, riz blanc » ; « Attiéké » retrouve « attieke poisson ».
 */

/** Clé de comparaison : minuscules, sans accents ni ponctuation, espaces simples */
export function dishKey(name: string) {
  return name
    .toLowerCase()
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Le plat du menu contient-il le plat préféré (mots entiers, dans l'ordre) ? */
export function matchesFavorite(dishName: string, favoriteKey: string) {
  if (!favoriteKey) return false;
  return ` ${dishKey(dishName)} `.includes(` ${favoriteKey} `);
}

/** Nombre maximal de plats préférés par étudiant */
export const MAX_FAVORITES = 20;
