import { ZodError } from "zod";
import type { Params } from "@/i18n/core";
import { after } from "next/server";
import { getI18n } from "@/i18n/server";
import { flushPush } from "./push";

/** Message traduisible : texte source français + paramètres d'interpolation */
export interface Msg {
  key: string;
  params?: Params;
}
export const msg = (key: string, params?: Params): Msg => ({ key, params });

/** Erreur métier : son message (source française) est destiné à l'utilisateur, traduit à l'affichage */
export class AppError extends Error {
  constructor(
    message: string,
    public code: string = "BUSINESS",
    public params?: Params,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export type ActionResult<T = undefined> = { ok: true; data: T; message?: string } | { ok: false; message: string; code?: string };

type MessageSpec<T> = string | Msg | ((data: T) => string | Msg);

/** Après la réponse : envoi push des notifications écrites par l'action (hors requête, ex. tests : rien) */
function schedulePush() {
  try {
    after(() => flushPush().catch((e) => console.error("[push]", e)));
  } catch {
    /* hors contexte de requête */
  }
}

/** Exécute une action et transforme les erreurs en résultat affichable, dans la langue de l'usager */
export async function run<T>(fn: () => Promise<T>, message?: MessageSpec<T>): Promise<ActionResult<T>> {
  const { t } = await getI18n();
  const render = (m: string | Msg | undefined) => (m === undefined ? undefined : typeof m === "string" ? (m ? t(m) : m) : t(m.key, m.params));
  try {
    const data = await fn();
    schedulePush();
    return { ok: true, data, message: render(typeof message === "function" ? message(data) : message) };
  } catch (e) {
    if (e instanceof AppError) return { ok: false, message: t(e.message, e.params), code: e.code };
    if (e instanceof ZodError) return { ok: false, message: t(e.issues[0]?.message ?? "Données invalides."), code: "VALIDATION" };
    // Erreurs de redirection Next.js : on les laisse passer
    if (e && typeof e === "object" && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_")) throw e;
    console.error("[action]", e);
    return { ok: false, message: t("Une erreur inattendue est survenue. Réessayez."), code: "INTERNAL" };
  }
}
