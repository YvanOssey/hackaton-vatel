"use client";

import { useState } from "react";
import { ArrowRight, CircleAlert, CircleCheck, Eye, EyeOff, LoaderCircle, type LucideIcon } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { cn, delay } from "@/lib/utils";

type FieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  icon: LucideIcon;
  hint?: React.ReactNode;
  error?: string;
  valid?: boolean;
  /** Délai d'apparition (ms) */
  enter?: number;
  trailing?: React.ReactNode;
};

/** Champ des écrans d'accès : libellé, icône, message d'aide ou d'erreur relié au champ */
export function AuthInput({ id, label, icon: Icon, hint, error, valid, enter = 0, trailing, className, ...input }: FieldProps) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={cn("anim-rise", className)} style={delay(enter)}>
      <label htmlFor={id} className="mb-1.5 flex items-center justify-between text-sm font-medium text-slate-700">
        {label}
      </label>
      <div
        className={cn(
          "group relative flex h-12 items-center rounded-xl bg-white ring-1 ring-inset transition-[box-shadow,background-color] duration-200",
          error
            ? "ring-red-300 focus-within:ring-2 focus-within:ring-red-500 focus-within:shadow-[0_0_0_4px_rgba(239,68,68,0.12)]"
            : "ring-slate-200 hover:ring-slate-300 focus-within:ring-2 focus-within:ring-brand-500 focus-within:shadow-[0_0_0_4px_rgba(47,139,198,0.12)]",
        )}
      >
        <Icon className={cn("pointer-events-none ml-3.5 size-[18px] shrink-0 transition-colors", error ? "text-red-400" : "text-slate-400 group-focus-within:text-brand-600")} aria-hidden />
        <input
          id={id}
          name={id}
          aria-invalid={!!error || undefined}
          aria-describedby={describedBy}
          className="h-full min-w-0 flex-1 bg-transparent px-3 text-[15px] text-slate-900 outline-none placeholder:text-slate-400"
          {...input}
        />
        {trailing}
        {valid && !error && !trailing && <CircleCheck className="mr-3.5 size-[18px] shrink-0 text-brand-500 [animation:pop_300ms_var(--ease-spring)]" aria-hidden />}
      </div>
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 flex items-center gap-1.5 text-[13px] text-red-600 [animation:fade-in_200ms_ease-out]">
          <CircleAlert className="size-3.5 shrink-0" /> {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-[13px] text-slate-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Mot de passe : affichage à la demande et alerte de verrouillage des majuscules */
export function PasswordInput(props: Omit<FieldProps, "type" | "trailing">) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  const [caps, setCaps] = useState(false);
  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => setCaps(e.getModifierState?.("CapsLock") ?? false);
  return (
    <AuthInput
      {...props}
      type={visible ? "text" : "password"}
      onKeyDown={onKey}
      onKeyUp={onKey}
      onBlur={(e) => {
        setCaps(false);
        props.onBlur?.(e);
      }}
      hint={caps ? <span className="font-medium text-amber-700">{t("Verrouillage des majuscules activé")}</span> : props.hint}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((x) => !x)}
          className="hit mr-1.5 flex size-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-brand-600"
          aria-label={visible ? t("Masquer le mot de passe") : t("Afficher le mot de passe")}
          aria-pressed={visible}
        >
          {visible ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
        </button>
      }
    />
  );
}

export function SubmitButton({ pending, children, enter = 0, className, disabled }: { pending: boolean; children: React.ReactNode; enter?: number; className?: string; disabled?: boolean }) {
  return (
    <div className={cn("anim-rise", className)} style={delay(enter)}>
      <button
        type="submit"
        disabled={pending || disabled}
        aria-busy={pending}
        className="group relative flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-brand-600 px-5 text-[15px] font-semibold text-white shadow-[0_1px_0_rgba(255,255,255,0.2)_inset,0_8px_20px_-8px_rgba(31,111,168,0.7)] transition hover:bg-brand-700 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
      >
        <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" aria-hidden />
        {pending ? <LoaderCircle className="size-5 animate-spin" /> : null}
        {children}
        {!pending && <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />}
      </button>
    </div>
  );
}

/** Erreur globale du formulaire ; `nonce` relance l'animation à chaque nouvel échec */
export function FormAlert({ message, nonce }: { message: string | null; nonce: number }) {
  if (!message) return null;
  return (
    <div key={nonce} role="alert" className="anim-shake flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-800">
      <CircleAlert className="mt-0.5 size-4 shrink-0 text-red-500" />
      <span>{message}</span>
    </div>
  );
}

export function AuthHeading({ eyebrow, title, subtitle }: { eyebrow?: string; title: string; subtitle?: React.ReactNode }) {
  return (
    <div className="anim-rise" style={delay(60)}>
      {eyebrow && <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">{eyebrow}</p>}
      <h1 className="font-display text-[1.9rem] font-bold leading-tight tracking-tight text-slate-900">{title}</h1>
      {subtitle && <p className="mt-2 text-[15px] leading-relaxed text-slate-500">{subtitle}</p>}
    </div>
  );
}
