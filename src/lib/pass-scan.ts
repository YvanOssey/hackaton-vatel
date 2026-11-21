/**
 * Lecture d'un pass scanné (caméra ou douchette), partagée entre la caisse et le serveur.
 *
 * Une douchette USB « tape » le contenu du QR comme un clavier. Réglée en QWERTY sur un poste
 * AZERTY (cas fréquent), elle produit « CC&:… » au lieu de « CC1.… » : les chiffres deviennent
 * des symboles, a/q et z/w s'inversent. On remet alors les caractères dans l'ordre QWERTY.
 */
const PASS = /^CC1\.[a-z0-9]{20,40}\.\d{1,6}\.[A-Za-z0-9_-]{22}$/;

/** Caractère produit par un poste AZERTY → caractère voulu par la douchette QWERTY */
const AZERTY_TO_QWERTY: Record<string, string> = {
  "&": "1", "é": "2", '"': "3", "'": "4", "(": "5", "-": "6", "è": "7", "_": "8", "ç": "9", "à": "0",
  a: "q", q: "a", z: "w", w: "z", A: "Q", Q: "A", Z: "W", W: "Z",
  ",": "m", "?": "M", ":": ".", ")": "-", "°": "_", ";": ",",
};

const stripPrefix = (v: string) => v.replace(/^(CANTINE|CQNTINE)[:.]/i, "");

/** Jeton de pass prêt à vérifier (corrige l'inversion de clavier), ou le texte tel quel s'il ne ressemble pas à un pass */
export function normalizeScan(raw: string): string {
  const v = stripPrefix(raw.trim());
  if (PASS.test(v)) return v;
  const fixed = [...v].map((c) => AZERTY_TO_QWERTY[c] ?? c).join("");
  return PASS.test(fixed) ? fixed : v;
}

/** Le texte saisi est-il un pass (y compris tapé par une douchette en mauvais clavier) ? */
export const looksLikePass = (v: string) => /^CC1\./i.test(normalizeScan(v)) || /^(CANTINE:)?CC&:/i.test(v.trim());
