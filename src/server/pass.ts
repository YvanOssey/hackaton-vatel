import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "./env";

/**
 * Pass numérique : jeton signé HMAC-SHA256 « CC1.<userId>.<version>.<signature> ».
 * Un QR inventé ou modifié est rejeté ; incrémenter passVersion révoque les anciens QR.
 */
function sign(userId: string, version: number) {
  return createHmac("sha256", env.authSecret).update(`pass:${userId}:${version}`).digest("base64url").slice(0, 22);
}

export function passToken(userId: string, version: number) {
  return `CC1.${userId}.${version}.${sign(userId, version)}`;
}

export function verifyPassToken(raw: string): { userId: string; version: number } | null {
  const m = /^CC1\.([a-z0-9]{20,40})\.(\d{1,6})\.([A-Za-z0-9_-]{22})$/.exec(raw.trim());
  if (!m) return null;
  const [, userId, v, sig] = m;
  const version = Number(v);
  const expected = Buffer.from(sign(userId, version));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  return { userId, version };
}
