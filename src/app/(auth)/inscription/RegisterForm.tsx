"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ArrowLeft, Check, GraduationCap, Hash, HeartHandshake, Lock, Mail, Phone, ShieldCheck, UserRound } from "lucide-react";
import { registerAction } from "@/app/actions/auth";
import { AllergenPicker } from "@/components/AllergenPicker";
import { AuthHeading, AuthInput, FormAlert, PasswordInput, SubmitButton } from "@/components/auth/fields";
import { useI18n } from "@/i18n/client";
import { cn, delay } from "@/lib/utils";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
type AccountType = "STUDENT" | "PARENT";
type Identity = { firstName: string; lastName: string; memberRef: string; email: string; phone: string };
type Errors = Partial<Record<keyof Identity | "password" | "confirm", string>>;

function strength(pw: string) {
  let s = 0;
  if (pw.length >= 10) s++;
  if (/[a-zA-Z]/.test(pw) && /\d/.test(pw)) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/[^a-zA-Z0-9]/.test(pw) || pw.length >= 14) s++;
  return s;
}
const LEVELS = [
  { label: "Trop court", color: "bg-red-500", text: "text-red-600" },
  { label: "Faible", color: "bg-orange-500", text: "text-orange-600" },
  { label: "Correct", color: "bg-amber-400", text: "text-amber-700" },
  { label: "Solide", color: "bg-lime-500", text: "text-lime-700" },
  { label: "Excellent", color: "bg-emerald-500", text: "text-emerald-700" },
];

const TYPES = [
  {
    id: "STUDENT" as const,
    icon: GraduationCap,
    title: "Étudiant",
    text: "Je réserve mes repas et je paie avec mon pass.",
  },
  {
    id: "PARENT" as const,
    icon: HeartHandshake,
    title: "Parent",
    text: "Je suis les repas de mon enfant et je recharge son compte.",
  },
];

function validateIdentity(id: Identity, type: AccountType): Errors {
  const e: Errors = {};
  if (!id.firstName.trim()) e.firstName = "Prénom requis.";
  if (!id.lastName.trim()) e.lastName = "Nom requis.";
  if (type === "STUDENT" && id.memberRef.trim().length < 3) e.memberRef = "Indiquez votre numéro étudiant.";
  if (!EMAIL.test(id.email.trim())) e.email = id.email ? "Adresse e-mail invalide." : "Adresse e-mail requise.";
  return e;
}

export function RegisterForm() {
  const { t } = useI18n();
  const [type, setType] = useState<AccountType>("STUDENT");
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [id, setId] = useState<Identity>({ firstName: "", lastName: "", memberRef: "", email: "", phone: "" });
  const [touched, setTouched] = useState<Partial<Record<keyof Identity, boolean>>>({});
  const [errors, setErrors] = useState<Errors>({});
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [allergens, setAllergens] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const [pending, start] = useTransition();

  const score = strength(password);
  const pwValid = password.length >= 10 && /[a-zA-Z]/.test(password) && /\d/.test(password);
  const live = validateIdentity(id, type);
  const steps = [t("Profil"), t("Identité"), t("Sécurité")];
  const tOpt = (k?: string) => (k ? t(k) : undefined);

  const field = (k: keyof Identity) => ({
    value: id[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      setId({ ...id, [k]: e.target.value });
      if (errors[k]) setErrors({ ...errors, [k]: undefined });
    },
    onBlur: () => setTouched((x) => ({ ...x, [k]: true })),
    error: tOpt(errors[k] ?? (touched[k] ? live[k] : undefined)),
    valid: !!id[k].trim() && !live[k],
  });

  const toSecurity = () => {
    const e = validateIdentity(id, type);
    setErrors(e);
    setTouched({ firstName: true, lastName: true, memberRef: true, email: true });
    const firstError = (["firstName", "lastName", "memberRef", "email"] as const).find((k) => e[k]);
    if (firstError) document.getElementById(firstError)?.focus();
    if (Object.keys(e).length === 0) {
      setError(null);
      setStep(3);
    }
  };

  const submit = () => {
    const e: Errors = {};
    if (!pwValid) e.password = "10 caractères minimum, avec des lettres et des chiffres.";
    if (confirm !== password) e.confirm = "Les deux mots de passe ne correspondent pas.";
    setErrors(e);
    if (Object.keys(e).length) return;
    start(async () => {
      const res = await registerAction({
        accountType: type,
        firstName: id.firstName,
        lastName: id.lastName,
        email: id.email,
        phone: id.phone || undefined,
        memberRef: type === "STUDENT" ? id.memberRef : undefined,
        allergens: type === "STUDENT" ? allergens : [],
        password,
      });
      if (res && !res.ok) {
        setError(res.message);
        setNonce((n) => n + 1);
        if (/e-mail|numéro|prénom|nom|email|number|name/i.test(res.message)) setStep(2);
      }
    });
  };

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (step === 1) setStep(2);
        else if (step === 2) toSecurity();
        else submit();
      }}
      className="space-y-6"
    >
      {/* Progression */}
      <ol className="anim-rise flex items-center gap-2" style={delay(0)} aria-label={t("Étapes de l'inscription")}>
        {steps.map((label, i) => {
          const n = (i + 1) as 1 | 2 | 3;
          const done = step > n;
          const current = step === n;
          return (
            <li key={label} className="flex flex-1 items-center gap-2" aria-current={current ? "step" : undefined}>
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition-colors duration-300",
                  done ? "bg-emerald-600 text-white" : current ? "bg-emerald-950 text-white" : "bg-slate-200 text-slate-500",
                )}
              >
                {done ? <Check className="size-3.5" strokeWidth={3} /> : n}
              </span>
              <span className={cn("hidden text-xs font-semibold sm:block", current ? "text-slate-900" : "text-slate-500")}>{label}</span>
              {i < steps.length - 1 && (
                <span className="h-0.5 flex-1 overflow-hidden rounded-full bg-slate-200">
                  <span className={cn("block h-full origin-left bg-emerald-600 transition-transform duration-500", done ? "scale-x-100" : "scale-x-0")} />
                </span>
              )}
            </li>
          );
        })}
      </ol>

      {step === 1 && (
        <div key="s1" className="space-y-5">
          <AuthHeading eyebrow={t("Bienvenue")} title={t("Qui êtes-vous ?")} subtitle={t("Votre espace s'adapte à votre profil.")} />
          <div className="grid gap-3" role="radiogroup" aria-label={t("Type de compte")}>
            {TYPES.map((ty, i) => {
              const on = type === ty.id;
              return (
                <button
                  key={ty.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setType(ty.id)}
                  className={cn(
                    "anim-rise group flex items-center gap-4 rounded-2xl bg-white p-4 text-left ring-1 ring-inset transition-[box-shadow,background-color] duration-200",
                    on ? "shadow-[0_0_0_4px_rgba(16,185,129,0.12)] ring-2 ring-emerald-500" : "ring-slate-200 hover:ring-slate-300",
                  )}
                  style={delay(140 + i * 70)}
                >
                  <span className={cn("flex size-12 shrink-0 items-center justify-center rounded-xl transition-colors", on ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-500 group-hover:bg-slate-200")}>
                    <ty.icon className="size-6" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-[17px] font-semibold text-slate-900">{t(ty.title)}</span>
                    <span className="block text-sm text-slate-500">{t(ty.text)}</span>
                  </span>
                  <span className={cn("flex size-5 shrink-0 items-center justify-center rounded-full ring-2 transition", on ? "bg-emerald-600 ring-emerald-600" : "ring-slate-300")}>
                    {on && <Check className="size-3 text-white" strokeWidth={3.5} />}
                  </span>
                </button>
              );
            })}
          </div>
          <SubmitButton pending={false} enter={300}>
            {t("Continuer")}
          </SubmitButton>
        </div>
      )}

      {step === 2 && (
        <div key="s2" className="space-y-5">
          <AuthHeading
            eyebrow={type === "STUDENT" ? t("Compte étudiant") : t("Compte parent")}
            title={t("Vos informations")}
            subtitle={type === "STUDENT" ? t("Votre numéro étudiant sera vérifié par l'administration.") : t("Vous associerez ensuite le compte de votre enfant avec son code.")}
          />
          <FormAlert message={error} nonce={nonce} />
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <AuthInput id="firstName" label={t("Prénom")} icon={UserRound} autoComplete="given-name" enter={120} {...field("firstName")} />
              <AuthInput id="lastName" label={t("Nom")} icon={UserRound} autoComplete="family-name" enter={160} {...field("lastName")} />
            </div>
            {type === "STUDENT" && <AuthInput id="memberRef" label={t("Numéro étudiant")} icon={Hash} spellCheck={false} autoComplete="off" autoCapitalize="characters" placeholder={t("Ex. VAT-2026-0142…")} enter={200} hint={t("Tel qu'il figure sur votre carte d'étudiant.")} {...field("memberRef")} />}
            <AuthInput id="email" label={t("Adresse e-mail")} icon={Mail} type="email" inputMode="email" autoComplete="email" spellCheck={false} autoCapitalize="none" enter={240} {...field("email")} />
            <AuthInput id="phone" label={t("Téléphone (facultatif)")} icon={Phone} type="tel" inputMode="tel" autoComplete="tel" placeholder="07 00 00 00 00…" enter={280} {...field("phone")} valid={false} />
          </div>
          <div className="flex gap-3">
            <BackButton onClick={() => setStep(1)} />
            <SubmitButton pending={false} enter={320} className="flex-1">
              {t("Continuer")}
            </SubmitButton>
          </div>
        </div>
      )}

      {step === 3 && (
        <div key="s3" className="space-y-5">
          <AuthHeading eyebrow={t("Dernière étape")} title={t("Sécurisez votre compte")} subtitle={type === "STUDENT" ? t("Vos allergies déclenchent une alerte bloquante en caisse.") : t("Choisissez un mot de passe solide.")} />
          <FormAlert message={error} nonce={nonce} />
          <div>
            <PasswordInput
              id="password"
              label={t("Mot de passe")}
              icon={Lock}
              autoComplete="new-password"
              enter={120}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setErrors({ ...errors, password: undefined });
              }}
              error={tOpt(errors.password)}
            />
            <div className="anim-rise mt-2.5 flex items-center gap-3" style={delay(160)} aria-live="polite">
              <div className="flex flex-1 gap-1">
                {[0, 1, 2, 3].map((i) => (
                  <span key={i} className={cn("h-1.5 flex-1 rounded-full transition-colors duration-300", password && i < Math.max(score, 1) ? LEVELS[score].color : "bg-slate-200")} />
                ))}
              </div>
              <span className={cn("w-20 text-right text-xs font-medium", password ? LEVELS[score].text : "text-slate-500")}>{password ? t(LEVELS[score].label) : t("10 car. min.")}</span>
            </div>
          </div>
          <PasswordInput
            id="confirm"
            label={t("Confirmation")}
            icon={ShieldCheck}
            autoComplete="new-password"
            enter={200}
            value={confirm}
            onChange={(e) => {
              setConfirm(e.target.value);
              setErrors({ ...errors, confirm: undefined });
            }}
            error={tOpt(errors.confirm ?? (confirm && confirm.length >= password.length && confirm !== password ? "Les deux mots de passe ne correspondent pas." : undefined))}
          />
          {type === "STUDENT" && (
            <div className="anim-rise" style={delay(260)}>
              <p className="mb-2 text-sm font-medium text-slate-700">{t("Allergies alimentaires")}</p>
              <AllergenPicker value={allergens} onChange={setAllergens} />
              <p className="mt-2 text-[13px] text-slate-500">{allergens.length ? t("{count} allergie(s) déclarée(s), modifiable dans votre profil.", { count: allergens.length }) : t("Aucune sélection : aucune alerte ne sera affichée.")}</p>
            </div>
          )}
          <div className="flex gap-3">
            <BackButton onClick={() => setStep(2)} />
            <SubmitButton pending={pending} enter={320} className="flex-1">
              {pending ? t("Création…") : t("Créer mon compte")}
            </SubmitButton>
          </div>
        </div>
      )}

      <p className="anim-rise text-center text-sm text-slate-600" style={delay(380)}>
        {t("Déjà inscrit ?")}{" "}
        <Link href="/connexion" className="font-semibold text-emerald-700 underline-offset-4 hover:underline">
          {t("Se connecter")}
        </Link>
      </p>
    </form>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      onClick={onClick}
      className="anim-rise flex h-12 shrink-0 items-center gap-1.5 rounded-xl bg-white px-4 text-sm font-semibold text-slate-700 ring-1 ring-inset ring-slate-200 transition hover:bg-slate-50"
      style={delay(300)}
      aria-label={t("Étape précédente")}
    >
      <ArrowLeft className="size-4" />
      <span className="hidden sm:inline">{t("Retour")}</span>
    </button>
  );
}
