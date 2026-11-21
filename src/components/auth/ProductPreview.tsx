"use client";

import { BellRing, Check, Star, TrendingUp, Wallet } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { delay } from "@/lib/utils";

/** Aperçu illustratif du produit (panneau de marque des écrans d'accès) */
export function ProductPreview() {
  const { t, num, tag } = useI18n();
  return (
    <div className="relative mx-auto h-[23rem] w-full max-w-[26rem]" aria-hidden>
      {/* Ticket du jour */}
      <div className="anim-rise absolute left-0 top-10 w-[16rem]" style={delay(350)}>
        <div className="anim-float" style={delay(0)}>
          <div className="ticket rounded-2xl bg-white text-slate-900 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.6)] [--cut:62%] [--notch:var(--color-brand-950)]">
            <div className="px-5 pb-4 pt-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-700">{t("Aujourd'hui")}</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700 ring-1 ring-brand-600/15">
                  <Check className="size-3" strokeWidth={3} /> {t("Réservé")}
                </span>
              </div>
              <p className="mt-2 pr-6 font-display text-[19px] font-semibold leading-snug">{t("Poulet yassa, riz parfumé")}</p>
              <p className="mt-1 text-xs text-slate-500">{t("Salade de crudités · Ananas frais")}</p>
            </div>
            <div className="ticket-cut mx-4" />
            <div className="flex items-center justify-between px-5 py-3.5">
              <div className="grid grid-cols-5 gap-[3px]">
                {[1, 0, 1, 1, 0, 0, 1, 0, 1, 1, 1, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1].map((on, i) => (
                  <span key={i} className={on ? "size-[5px] rounded-[1px] bg-slate-900" : "size-[5px]"} />
                ))}
              </div>
              <span className="font-display text-lg font-bold tabular-nums">{num(1500)} F</span>
            </div>
          </div>
        </div>
      </div>

      {/* Solde */}
      <div className="anim-rise absolute -right-2 top-0 w-44" style={delay(520)}>
        <div className="anim-float rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 p-4 text-brand-950 shadow-[0_24px_40px_-16px_rgba(47,139,198,0.6)]" style={{ ...delay(900), "--r": "3deg" } as React.CSSProperties}>
          <div className="flex items-center justify-between">
            <span className="flex size-7 items-center justify-center rounded-lg bg-white/30">
              <Wallet className="size-4" />
            </span>
            <TrendingUp className="size-4 opacity-70" />
          </div>
          <p className="mt-3 text-[11px] font-semibold uppercase tracking-wider opacity-70">{t("Solde")}</p>
          <p className="font-display text-2xl font-bold tabular-nums">{num(12500)} F</p>
          <svg viewBox="0 0 120 24" className="mt-1 h-5 w-full" fill="none">
            <path d="M0 20 L20 16 L40 18 L60 9 L80 12 L100 4 L120 6" stroke="currentColor" strokeOpacity="0.55" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      {/* Notification parent */}
      <div className="anim-rise absolute bottom-10 right-2 w-64" style={delay(700)}>
        <div className="anim-float flex items-center gap-3 rounded-2xl bg-white/95 p-3 pr-4 text-slate-900 shadow-[0_24px_40px_-16px_rgba(0,0,0,0.55)] backdrop-blur" style={delay(1800)}>
          <span className="relative flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
            <BellRing className="size-4" />
            <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-red-500 ring-2 ring-white" />
          </span>
          <div className="min-w-0 text-xs">
            <p className="font-semibold">{t("Maman a rechargé {amount} F", { amount: num(5000) })}</p>
            <p className="text-slate-500">{t("via Wave · à l'instant")}</p>
          </div>
        </div>
      </div>

      {/* Note */}
      <div className="anim-rise absolute bottom-0 left-8" style={delay(860)}>
        <div className="anim-float flex items-center gap-2 rounded-full bg-brand-900/80 px-3.5 py-2 text-xs font-medium text-brand-50 ring-1 ring-white/10 backdrop-blur" style={delay(2600)}>
          <span className="flex">
            {[0, 1, 2, 3, 4].map((i) => (
              <Star key={i} className="size-3.5 fill-amber-300 text-amber-300" />
            ))}
          </span>
          {t("{score} · avis des étudiants", { score: (4.8).toLocaleString(tag) })}
        </div>
      </div>
    </div>
  );
}
