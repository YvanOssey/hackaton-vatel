import "server-only";
import { getCurrentUser } from "./auth";
import { AppError } from "./errors";

/** Usager authentifié pour une action serveur (les droits sont vérifiés dans chaque service) */
export async function currentActor() {
  const user = await getCurrentUser();
  if (!user) throw new AppError("Session expirée, reconnectez-vous.", "UNAUTHENTICATED");
  if (user.mustChangePassword) throw new AppError("Changez d'abord votre mot de passe provisoire.", "PASSWORD_CHANGE");
  return user;
}
