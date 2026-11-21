"use client";

import { Star, X } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import type { NutriScore } from "@prisma/client";
import { NUTRI_COLORS, allergenLabel } from "@/lib/constants";
import { useI18n } from "@/i18n/client";
import { avatarColor, cn, initials } from "@/lib/utils";

export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("rounded-2xl bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-18px_rgba(15,23,42,0.12)] ring-1 ring-slate-900/[0.06]", className)} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action, icon }: { title: React.ReactNode; subtitle?: React.ReactNode; action?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
      <div className="flex min-w-0 items-start gap-3">
        {icon && <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700 ring-1 ring-brand-600/10">{icon}</div>}
        <div className="min-w-0">
          <h2 className="font-display text-base font-semibold tracking-tight text-slate-900">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info" | "brand";
const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: "bg-slate-100 text-slate-700 ring-slate-500/15",
  success: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  warning: "bg-amber-50 text-amber-800 ring-amber-600/25",
  danger: "bg-red-50 text-red-700 ring-red-600/20",
  info: "bg-sky-50 text-sky-700 ring-sky-600/20",
  brand: "bg-brand-600 text-white ring-brand-700",
};

export function Badge({ tone = "neutral", className, children }: { tone?: BadgeTone; className?: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", BADGE_TONES[tone], className)}>
      {children}
    </span>
  );
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "dark" | "destructive";
type ButtonSize = "sm" | "md" | "lg" | "xl";
const BTN_VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_6px_16px_-8px_rgba(31,111,168,0.7)]",
  secondary: "bg-white text-slate-800 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 active:bg-slate-100",
  ghost: "text-slate-700 hover:bg-slate-100 active:bg-slate-200",
  danger: "bg-white text-red-700 ring-1 ring-inset ring-red-200 hover:bg-red-50 active:bg-red-100",
  dark: "bg-slate-900 text-white hover:bg-slate-800 active:bg-slate-950 shadow-sm",
  destructive: "bg-red-600 text-white hover:bg-red-700 active:bg-red-800 shadow-[0_6px_16px_-8px_rgba(220,38,38,0.7)]",
};
const BTN_SIZES: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-sm gap-1.5 rounded-lg",
  md: "h-11 px-4 text-sm gap-2 rounded-xl",
  lg: "h-12 px-5 text-base gap-2 rounded-xl",
  xl: "h-16 px-6 text-lg gap-3 rounded-2xl",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return (
    <button
      type={props.type ?? "button"}
      className={cn(
        "hit inline-flex select-none items-center justify-center font-semibold transition-[background-color,color,box-shadow,transform] duration-150 active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100",
        BTN_VARIANTS[variant],
        BTN_SIZES[size],
        className,
      )}
      {...props}
    />
  );
}

export function Avatar({ user, size = "md" }: { user: { id: string; firstName: string; lastName: string }; size?: "sm" | "md" | "lg" | "xl" }) {
  const sizes = { sm: "size-8 text-xs", md: "size-10 text-sm", lg: "size-14 text-lg", xl: "size-20 text-2xl" };
  return (
    <div
      className={cn("flex shrink-0 items-center justify-center rounded-full font-semibold text-white", sizes[size])}
      style={{ backgroundColor: avatarColor(user.id) }}
      aria-hidden
    >
      {initials(user.firstName, user.lastName)}
    </div>
  );
}

export function AllergenChip({ id, highlight }: { id: string; highlight?: boolean }) {
  const { t } = useI18n();
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium",
        highlight ? "bg-red-100 text-red-700 ring-1 ring-inset ring-red-300" : "bg-slate-100 text-slate-600",
      )}
    >
      {t(allergenLabel(id))}
    </span>
  );
}

export function NutriBadge({ score }: { score: NutriScore }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 py-0.5 pl-1.5 pr-0.5 text-[11px] font-medium text-slate-600" title={`Nutri-Score ${score}`}>
      Nutri
      <span className={cn("flex size-4 items-center justify-center rounded text-[10px] font-bold text-white", NUTRI_COLORS[score])}>{score}</span>
    </span>
  );
}

export function Stat({
  label,
  value,
  hint,
  icon,
  tone = "neutral",
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger";
}) {
  const tones = {
    neutral: "bg-slate-100 text-slate-600",
    success: "bg-emerald-50 text-emerald-600",
    warning: "bg-amber-50 text-amber-600",
    danger: "bg-red-50 text-red-600",
  };
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        {icon && <div className={cn("flex size-9 items-center justify-center rounded-xl", tones[tone])}>{icon}</div>}
      </div>
      <p className="mt-2 font-display text-[1.9rem] font-bold leading-none tracking-tight text-slate-900 tabular-nums">{value}</p>
      {hint && <div className="mt-1 text-sm text-slate-500">{hint}</div>}
    </Card>
  );
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Fenêtre modale accessible : le focus entre dans la fenêtre, y reste (Tab / Maj+Tab),
 * revient sur le déclencheur à la fermeture ; la page derrière ne défile plus.
 */
export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const { t } = useI18n();
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    if (!open) return;
    const trigger = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const first = panel.current?.querySelector<HTMLElement>("[data-autofocus]") ?? panel.current?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel.current)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return close.current();
      if (e.key !== "Tab" || !panel.current) return;
      const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const [a, z] = [items[0], items[items.length - 1]];
      if (e.shiftKey && document.activeElement === a) {
        e.preventDefault();
        z.focus();
      } else if (!e.shiftKey && document.activeElement === z) {
        e.preventDefault();
        a.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      trigger?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overscroll-contain sm:items-center" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] animate-[fade-in_150ms_ease-out]" onClick={onClose} aria-hidden />
      <div ref={panel} tabIndex={-1} className="relative max-h-[92dvh] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-3xl bg-white pb-[env(safe-area-inset-bottom)] shadow-xl outline-none animate-[slide-up_200ms_ease-out] sm:rounded-3xl sm:pb-0">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 id={titleId} className="text-base font-semibold text-slate-900">
            {title}
          </h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-brand-600" aria-label={t("Fermer")}>
            <X className="size-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function EmptyState({ icon, title, children }: { icon: React.ReactNode; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
      <div className="relative flex size-14 items-center justify-center rounded-2xl bg-slate-50 text-slate-400 ring-1 ring-slate-900/5">
        {icon}
        <span className="absolute -right-1 -top-1 size-3 rounded-full bg-brand-200 ring-4 ring-white" />
      </div>
      <p className="mt-4 font-display font-semibold text-slate-800">{title}</p>
      {children && <div className="mt-1 max-w-xs text-sm text-slate-500">{children}</div>}
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode }[];
  className?: string;
}) {
  return (
    <div className={cn("inline-flex rounded-xl bg-slate-100 p-1", className)} role="group">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "hit flex min-h-9 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-brand-600",
            value === o.value ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export { inputCls } from "@/lib/styles";

export function Field({ label, hint, error, children, htmlFor }: { label: string; hint?: React.ReactNode; error?: string; children: React.ReactNode; htmlFor?: string }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
      {error ? <p className="mt-1 text-sm text-red-600">{error}</p> : hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function PageTitle({ eyebrow, title, children }: { eyebrow?: string; title: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="anim-rise mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-700">{eyebrow}</p>}
        <h1 className="mt-1.5 font-display text-[1.75rem] font-bold leading-tight tracking-tight text-balance text-slate-900 sm:text-3xl">{title}</h1>
      </div>
      {children}
    </div>
  );
}

/** Note sur 5 : lecture seule ou sélection au clic */
export function Stars({ value, onChange, size = "md", label }: { value: number; onChange?: (v: number) => void; size?: "sm" | "md" | "lg"; label?: string }) {
  const { t, tag } = useI18n();
  const px = { sm: "size-3.5", md: "size-5", lg: "size-8" }[size];
  if (!onChange) {
    return (
      <span className="inline-flex items-center gap-0.5" role="img" aria-label={label ?? t("{score} sur 5", { score: value.toLocaleString(tag, { maximumFractionDigits: 1 }) })}>
        {[1, 2, 3, 4, 5].map((i) => (
          <Star key={i} className={cn(px, i <= Math.round(value) ? "fill-amber-400 text-amber-400" : "fill-slate-200 text-slate-200")} />
        ))}
      </span>
    );
  }
  return (
    <span className="-my-2.5 inline-flex items-center" role="radiogroup" aria-label={label ?? t("Note")}>
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          role="radio"
          aria-checked={value === i}
          aria-label={t("{score} sur 5", { score: i })}
          onClick={() => onChange(i)}
          className="flex size-11 items-center justify-center rounded-lg transition-transform hover:scale-110 active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-brand-600"
        >
          <Star className={cn(size === "md" ? "size-6" : px, "transition-colors", i <= value ? "fill-amber-400 text-amber-400" : "fill-slate-100 text-slate-300")} />
        </button>
      ))}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-xl", className)} aria-hidden />;
}

/** Confirmation d'une action destructive : « Annuler » reçoit le focus, l'action se confirme explicitement */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  confirmLabel,
  pending,
  tone = "danger",
  children,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  confirmLabel: string;
  pending?: boolean;
  tone?: "danger" | "dark";
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  return (
    <Modal open={open} onClose={() => !pending && onClose()} title={title}>
      <div className="text-sm leading-relaxed text-slate-600">{children}</div>
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onClose} disabled={pending} data-autofocus>
          {t("Annuler")}
        </Button>
        <Button variant={tone === "danger" ? "destructive" : "dark"} onClick={onConfirm} disabled={pending}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
