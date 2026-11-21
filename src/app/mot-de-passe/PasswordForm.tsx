"use client";

import { useState, useTransition } from "react";
import { Lock, ShieldCheck } from "lucide-react";
import { changePasswordAction } from "@/app/actions/auth";
import { FormAlert, PasswordInput, SubmitButton } from "@/components/auth/fields";
import { useI18n } from "@/i18n/client";

export function PasswordForm() {
  const { t } = useI18n();
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, start] = useTransition();
  const fail = (m: string) => {
    setError(m);
    setNonce((n) => n + 1);
  };
  return (
    <form
      noValidate
      className="mt-6 space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        if (next !== confirm) return fail(t("Les deux mots de passe ne correspondent pas."));
        setError(null);
        start(async () => {
          const res = await changePasswordAction(String(fd.get("current")), next);
          if (res && !res.ok) fail(res.message);
        });
      }}
    >
      <FormAlert message={error} nonce={nonce} />
      <PasswordInput id="current" label={t("Mot de passe actuel (ou provisoire)")} icon={Lock} autoComplete="current-password" required enter={80} />
      <PasswordInput id="next" label={t("Nouveau mot de passe")} icon={Lock} autoComplete="new-password" hint={t("10 caractères minimum, lettres et chiffres.")} value={next} onChange={(e) => setNext(e.target.value)} enter={120} />
      <PasswordInput
        id="confirm"
        label={t("Confirmation")}
        icon={ShieldCheck}
        autoComplete="new-password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        error={confirm && confirm.length >= next.length && confirm !== next ? t("Les deux mots de passe ne correspondent pas.") : undefined}
        enter={160}
      />
      <SubmitButton pending={pending} enter={200}>
        {t("Enregistrer")}
      </SubmitButton>
    </form>
  );
}
