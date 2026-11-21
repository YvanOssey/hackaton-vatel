import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { ROLES } from "@/lib/constants";
import { prisma } from "./db";

export const SESSION_COOKIE = "cc_session";
const SESSION_DAYS = 7;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createSession(userId: string, userAgent?: string | null) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await prisma.session.create({ data: { tokenHash: hashToken(token), userId, expiresAt, userAgent: userAgent?.slice(0, 200) } });
  // Ménage opportuniste des sessions expirées
  await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  // Cookie « Secure » dès que la requête arrive en HTTPS (Vercel, proxy) ; en HTTP local (Docker, téléphone en Wi-Fi), il serait refusé par le navigateur
  const h = await headers();
  const https = (h.get("x-forwarded-proto") ?? "").split(",")[0].trim() === "https" || (h.get("origin") ?? "").startsWith("https://");
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: https,
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  jar.delete(SESSION_COOKIE);
}

/** Usager de la requête courante (mis en cache pour la durée de la requête) */
export const getCurrentUser = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true } });
  if (!session || session.expiresAt < new Date()) return null;
  const { user } = session;
  if (user.status === "REJECTED" || user.status === "SUSPENDED") return null;
  if (user.status === "PENDING" && user.role !== "CONSUMER") return null;
  return user;
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

/** Garde des pages : redirige vers la connexion ou l'espace du rôle si l'accès est refusé */
export async function requireUser(roles?: Role[], opts: { allowPasswordChange?: boolean } = {}) {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");
  if (user.mustChangePassword && !opts.allowPasswordChange) redirect("/mot-de-passe");
  if (roles && !roles.includes(user.role)) redirect(ROLES[user.role].home);
  return user;
}
