"use client";

import { useState } from "react";
import { Check, Copy, KeyRound } from "lucide-react";
import { useI18n } from "@/i18n/client";

/** Affiche une seule fois un mot de passe provisoire à transmettre */
export function OneTimePassword({ email, password, onDone }: { email?: string; password: string; onDone: () => void }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-2xl border-2 border-emerald-500 bg-emerald-50 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
        <KeyRound className="size-4" /> {email ? t("Mot de passe provisoire pour {email}", { email }) : t("Mot de passe provisoire")}
      </p>
      <div className="mt-2 flex items-center gap-2">
        <code className="flex-1 select-all rounded-lg bg-white px-3 py-2 font-mono text-base text-slate-900">{password}</code>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(password);
              setCopied(true);
            } catch {
              /* sélection manuelle possible */
            }
          }}
          className="rounded-lg p-2 text-emerald-800 hover:bg-emerald-100"
          aria-label={t("Copier")}
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        </button>
      </div>
      <p className="mt-2 text-xs text-emerald-900">{t("Transmettez-le en main propre. Il ne sera plus affiché ; la personne devra le changer à sa première connexion.")}</p>
      <button type="button" onClick={onDone} className="mt-2 text-xs font-semibold text-emerald-800 underline">
        {t("J'ai transmis le mot de passe")}
      </button>
    </div>
  );
}
