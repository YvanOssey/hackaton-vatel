"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, FlaskConical, LoaderCircle, Phone, Smartphone, Zap } from "lucide-react";
import type { MobileProvider } from "@prisma/client";
import { confirmTopUpAction, initiateTopUpAction } from "@/app/actions/payments";
import { Button, Modal } from "@/components/ui";
import { MOBILE_PROVIDERS, ONLINE_TOPUP_PRESETS, TOPUP_MAX, TOPUP_MIN, normalizeCiPhone } from "@/lib/constants";
import { cn, elides } from "@/lib/utils";
import { rich } from "@/i18n/rich";
import { useI18n } from "@/i18n/client";

type Stage =
  | { kind: "form" }
  | { kind: "waiting"; id: string; reference: string; amount: number; provider: MobileProvider; phone: string; sandbox: boolean }
  | { kind: "success"; amount: number; balance: number | null }
  | { kind: "failed"; reason: string };

export function ProviderLogo({ provider, className }: { provider: MobileProvider; className?: string }) {
  const p = MOBILE_PROVIDERS[provider];
  return (
    <span className={cn("flex items-center justify-center rounded-xl font-display text-sm font-extrabold", className)} style={{ background: p.bg, color: p.fg }} aria-hidden>
      {p.short}
    </span>
  );
}

/** Bouton + fenêtre de rechargement Mobile Money */
export function TopUpButton({ beneficiaryId, beneficiaryName, className, label, variant = "primary" }: { beneficiaryId: string; beneficiaryName?: string; className?: string; label?: string; variant?: "primary" | "secondary" | "dark" }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} className={className} onClick={() => setOpen(true)}>
        <Smartphone className="size-4" /> {label ?? t("Recharger en ligne")}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={beneficiaryName ? (elides(beneficiaryName) ? t("Recharger le compte d'{name}", { name: beneficiaryName }) : t("Recharger le compte de {name}", { name: beneficiaryName })) : t("Recharger mon portefeuille")}>
        {open && <TopUpFlow beneficiaryId={beneficiaryId} onDone={() => setOpen(false)} />}
      </Modal>
    </>
  );
}

export function TopUpFlow({ beneficiaryId, onDone }: { beneficiaryId: string; onDone: () => void }) {
  const router = useRouter();
  const { t, money } = useI18n();
  const [stage, setStage] = useState<Stage>({ kind: "form" });
  const [provider, setProvider] = useState<MobileProvider>("WAVE");
  const [amount, setAmount] = useState<number>(5_000);
  const [custom, setCustom] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [tried, setTried] = useState(false);
  const [pending, start] = useTransition();

  const value = custom ? Number(custom.replace(/\D/g, "")) : amount;
  const phoneOk = !!normalizeCiPhone(phone);
  const amountOk = Number.isInteger(value) && value >= TOPUP_MIN && value <= TOPUP_MAX;

  const initiate = () =>
    start(async () => {
      setError(null);
      const res = await initiateTopUpAction({ beneficiaryId, provider, phone, amount: value });
      if (!res.ok) return setError(res.message);
      setStage({ kind: "waiting", ...res.data });
    });

  const confirm = (id: string, amt: number) =>
    start(async () => {
      const res = await confirmTopUpAction(id);
      if (!res.ok) return setStage({ kind: "failed", reason: res.message });
      const r = res.data;
      if (r.status === "SUCCEEDED") {
        setStage({ kind: "success", amount: amt, balance: r.balance });
        router.refresh();
      } else if (r.status === "PENDING") setError(t("Paiement pas encore validé sur votre téléphone. Réessayez dans un instant."));
      else setStage({ kind: "failed", reason: t(r.reason ?? (r.status === "EXPIRED" ? "Délai de validation dépassé." : "Paiement refusé.")) });
    });

  if (stage.kind === "success") {
    return (
      <div className="flex flex-col items-center py-4 text-center">
        <svg viewBox="0 0 52 52" className="size-16" aria-hidden>
          <circle cx="26" cy="26" r="24" className="fill-emerald-50 stroke-emerald-500" strokeWidth="2" />
          <path d="M15 27l7 7 15-16" fill="none" className="stroke-emerald-600" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="24" style={{ animation: "check 500ms var(--ease-out-expo) 150ms both" }} />
        </svg>
        <p className="mt-4 font-display text-xl font-bold text-slate-900">+{money(stage.amount)}</p>
        <p className="mt-1 text-sm text-slate-500">{stage.balance !== null ? t("Nouveau solde : {balance:money}", { balance: stage.balance }) : t("Portefeuille crédité.")}</p>
        <Button className="mt-6 w-full" size="lg" onClick={onDone}>
          {t("Terminer")}
        </Button>
      </div>
    );
  }

  if (stage.kind === "failed") {
    return (
      <div className="flex flex-col items-center py-4 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-red-50 text-red-600 ring-1 ring-red-200">
          <CircleAlert className="size-7" />
        </span>
        <p className="mt-4 font-display text-lg font-bold text-slate-900">{t("Paiement non abouti")}</p>
        <p className="mt-1 max-w-xs text-sm text-slate-500">{stage.reason} {t("Aucun montant n'a été crédité.")}</p>
        <div className="mt-6 flex w-full gap-2">
          <Button variant="secondary" className="flex-1" onClick={onDone}>
            {t("Fermer")}
          </Button>
          <Button className="flex-1" onClick={() => setStage({ kind: "form" })}>
            {t("Réessayer")}
          </Button>
        </div>
      </div>
    );
  }

  if (stage.kind === "waiting") {
    const p = MOBILE_PROVIDERS[stage.provider];
    return (
      <div className="space-y-5">
        <div className="flex flex-col items-center text-center">
          <div className="relative">
            <span className="anim-ping-soft absolute inset-0 rounded-2xl" style={{ background: p.bg }} aria-hidden />
            <ProviderLogo provider={stage.provider} className="relative size-16 text-lg" />
          </div>
          <p className="mt-4 font-display text-lg font-bold text-slate-900">{t("Validez sur votre téléphone")}</p>
          <p className="mt-1 text-sm text-slate-500">
            {rich(t("Une demande de {amount} a été envoyée au {phone} via {provider}."), {
              amount: <strong className="text-slate-800">{money(stage.amount)}</strong>,
              phone: stage.phone.replace(/(\d{2})(?=\d)/g, "$1 "),
              provider: p.label,
            })}
          </p>
          <p className="mt-2 font-mono text-xs text-slate-500">{t("Réf.")} {stage.reference}</p>
        </div>
        {stage.sandbox && (
          <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-xs text-amber-900 ring-1 ring-inset ring-amber-200">
            <FlaskConical className="mt-0.5 size-4 shrink-0" />
            {t("Mode test : l'opérateur est simulé, aucun argent réel ne circule. Un numéro finissant par 0000 simule un refus.")}
          </p>
        )}
        {error && <p className="rounded-xl bg-slate-100 px-3 py-2.5 text-sm text-slate-700">{error}</p>}
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onDone} disabled={pending}>
            {t("Plus tard")}
          </Button>
          <Button className="flex-1" onClick={() => confirm(stage.id, stage.amount)} disabled={pending}>
            {pending ? <LoaderCircle className="size-4 animate-spin" /> : null} {t("J'ai validé")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        setTried(true);
        if (!amountOk) return document.getElementById("topup-amount")?.focus();
        if (!phoneOk) return document.getElementById("topup-phone")?.focus();
        initiate();
      }}
    >
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-slate-700">{t("Opérateur")}</legend>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(MOBILE_PROVIDERS) as MobileProvider[]).map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={provider === id}
              onClick={() => setProvider(id)}
              className={cn("flex items-center gap-3 rounded-xl bg-white p-3 text-left ring-1 ring-inset transition", provider === id ? "ring-2 ring-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.12)]" : "ring-slate-200 hover:ring-slate-300")}
            >
              <ProviderLogo provider={id} className="size-9" />
              <span className="text-sm font-semibold text-slate-800">{MOBILE_PROVIDERS[id].label}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-slate-700">{t("Montant")}</legend>
        <div className="grid grid-cols-4 gap-2">
          {ONLINE_TOPUP_PRESETS.map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={!custom && amount === v}
              onClick={() => {
                setAmount(v);
                setCustom("");
              }}
              className={cn("h-11 rounded-xl text-sm font-semibold tabular-nums ring-1 ring-inset transition", !custom && amount === v ? "bg-emerald-600 text-white ring-emerald-600" : "bg-white text-slate-700 ring-slate-200 hover:ring-slate-300")}
            >
              {money(v).replace(" FCFA", "")}
            </button>
          ))}
        </div>
        <label className="mt-2 flex h-11 items-center rounded-xl bg-white ring-1 ring-inset ring-slate-200 focus-within:ring-2 focus-within:ring-emerald-500">
          <span className="sr-only">{t("Autre montant")}</span>
          <input
            id="topup-amount"
            name="amount"
            inputMode="numeric"
            autoComplete="off"
            aria-invalid={(tried || !!custom) && !amountOk ? true : undefined}
            value={custom}
            onChange={(e) => setCustom(e.target.value.replace(/[^\d]/g, "").slice(0, 7))}
            placeholder={t("Autre montant…")}
            className="h-full min-w-0 flex-1 bg-transparent px-3.5 text-sm tabular-nums outline-none placeholder:text-slate-400"
          />
          <span className="pr-3.5 text-sm text-slate-500">FCFA</span>
        </label>
        {(custom || tried) && !amountOk && <p className="mt-1.5 text-xs text-red-600">{t("Entre {min:money} et {max:money}.", { min: TOPUP_MIN, max: TOPUP_MAX })}</p>}
      </fieldset>

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-slate-700">{t("Numéro {provider}", { provider: MOBILE_PROVIDERS[provider].label })}</span>
        <span className="flex h-11 items-center rounded-xl bg-white ring-1 ring-inset ring-slate-200 focus-within:ring-2 focus-within:ring-emerald-500">
          <Phone className="ml-3.5 size-4 text-slate-400" />
          <input
            id="topup-phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            aria-invalid={(tried || !!phone) && !phoneOk ? true : undefined}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="07 08 09 10 11…"
            className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm outline-none placeholder:text-slate-400"
          />
        </span>
        {(phone || tried) && !phoneOk && <span className="mt-1.5 block text-xs text-red-600">{t("10 chiffres commençant par 01, 05 ou 07.")}</span>}
      </label>

      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700">
          <CircleAlert className="mt-0.5 size-4 shrink-0" /> {error}
        </p>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? <LoaderCircle className="size-5 animate-spin" /> : <Zap className="size-4" />}
        {amountOk ? t("Payer {amount:money}", { amount: value }) : t("Payer")}
      </Button>
      <p className="text-center text-xs text-slate-500">{t("Le portefeuille n'est crédité qu'après la validation de l'opérateur.")}</p>
    </form>
  );
}
