const DEV_SECRET = "dev-only-secret-change-me-0123456789abcdef0123456789abcdef";

function secret() {
  const s = process.env.AUTH_SECRET;
  if (s && s.length >= 32 && (process.env.NODE_ENV !== "production" || s !== DEV_SECRET)) return s;
  if (process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build") {
    throw new Error("AUTH_SECRET manquant ou trop court (32 caractères minimum) en production.");
  }
  return DEV_SECRET;
}

export const env = {
  get authSecret() {
    return secret();
  },
  // Guillemets retirés : certains outils (docker --env-file) les transmettent tels quels
  timezone: process.env.APP_TIMEZONE?.trim().replace(/^["']|["']$/g, "") || "Africa/Abidjan",
  isProd: process.env.NODE_ENV === "production",
};
