"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Mail, Lock } from "lucide-react";
import { loginAction } from "@/app/actions/auth";
import { AuthHeading, AuthInput, FormAlert, PasswordInput, SubmitButton } from "@/components/auth/fields";
import { useI18n } from "@/i18n/client";
import { delay } from "@/lib/utils";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginForm() {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState({ email: false, password: false });
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const [pending, start] = useTransition();

  const emailError = touched.email && !EMAIL.test(email.trim()) ? (email ? t("Adresse e-mail invalide.") : t("Saisissez votre adresse e-mail.")) : undefined;
  const passwordError = touched.password && !password ? t("Saisissez votre mot de passe.") : undefined;

  return (
    <form
      noValidate
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        setTouched({ email: true, password: true });
        if (!EMAIL.test(email.trim()) || !password) {
          // Focus sur le premier champ en erreur
          document.getElementById(!EMAIL.test(email.trim()) ? "email" : "password")?.focus();
          return;
        }
        start(async () => {
          const res = await loginAction(email, password);
          if (res && !res.ok) {
            setError(res.message);
            setNonce((n) => n + 1);
          }
        });
      }}
    >
      <AuthHeading eyebrow={t("Bon retour")} title={t("Connectez-vous")} subtitle={t("Réservez votre repas, suivez votre solde et présentez votre pass en caisse.")} />
      <FormAlert message={error} nonce={nonce} />
      <div className="space-y-4">
        <AuthInput
          id="email"
          label={t("Adresse e-mail")}
          icon={Mail}
          type="email"
          autoComplete="email"
          inputMode="email"
          spellCheck={false}
          autoCapitalize="none"
          placeholder={t("prenom.nom@exemple.com…")}
          enter={140}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => setTouched((x) => ({ ...x, email: true }))}
          error={emailError}
          valid={EMAIL.test(email.trim())}
        />
        <PasswordInput
          id="password"
          label={t("Mot de passe")}
          icon={Lock}
          autoComplete="current-password"
          enter={200}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onBlur={() => setTouched((x) => ({ ...x, password: true }))}
          error={passwordError}
        />
      </div>
      <SubmitButton pending={pending} enter={260}>
        {pending ? t("Connexion…") : t("Se connecter")}
      </SubmitButton>
      <div className="anim-rise space-y-3 text-center text-sm" style={delay(320)}>
        <p className="text-slate-600">
          {t("Pas encore de compte ?")}{" "}
          <Link href="/inscription" className="font-semibold text-emerald-700 underline-offset-4 hover:underline">
            {t("Créer un compte")}
          </Link>
        </p>
        <p className="text-xs text-slate-500">{t("Mot de passe oublié ? L'administration du restaurant peut le réinitialiser.")}</p>
      </div>
    </form>
  );
}
