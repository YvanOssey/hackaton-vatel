import type { Metadata } from "next";
import { ArrowDownLeft, ArrowUpRight, Info, Receipt, Store, TriangleAlert, Utensils } from "lucide-react";
import { Brand } from "@/components/brand";
import { TopUpButton } from "@/components/payments/TopUpFlow";
import { Card, CardHeader, EmptyState, PageTitle } from "@/components/ui";
import { METHODS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { I18n } from "@/i18n/core";
import { requireUser } from "@/server/auth";
import { env } from "@/server/env";
import { consumerWallet } from "@/server/services/queries";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t("Portefeuille") };
}

/** Libellé de jour relatif pour regrouper l'historique */
function dayKey(iso: string, { t, tag }: I18n) {
  const d = new Date(iso);
  const fmt = (x: Date) => x.toLocaleDateString(tag, { timeZone: env.timezone, year: "numeric", month: "2-digit", day: "2-digit" });
  const now = new Date();
  const yesterday = new Date(now.getTime() - 86_400_000);
  if (fmt(d) === fmt(now)) return t("Aujourd'hui");
  if (fmt(d) === fmt(yesterday)) return t("Hier");
  const s = d.toLocaleDateString(tag, { timeZone: env.timezone, weekday: "long", day: "numeric", month: "long" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default async function WalletPage() {
  const user = await requireUser(["CONSUMER"]);
  const w = await consumerWallet(user);
  const i18n = await getI18n();
  const { t, money, time, note } = i18n;
  const low = w.balance < w.lowBalanceThreshold;
  const groups = new Map<string, typeof w.transactions>();
  for (const tx of w.transactions) groups.set(dayKey(tx.createdAt, i18n), [...(groups.get(dayKey(tx.createdAt, i18n)) ?? []), tx]);

  return (
    <>
      <PageTitle eyebrow={t("Portefeuille")} title={t("Solde et opérations")} />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,390px)_1fr]">
        <div className="space-y-5">
          {/* Carte de solde */}
          <div className="anim-rise relative overflow-hidden rounded-3xl bg-emerald-950 p-6 text-white shadow-[0_24px_60px_-28px_rgba(2,44,34,0.8)]">
            <div className="bg-grid pointer-events-none absolute inset-0 [mask-image:linear-gradient(135deg,black,transparent_70%)]" />
            <div className="pointer-events-none absolute -bottom-24 -right-16 size-64 rounded-full bg-emerald-500/25 blur-3xl" />
            <div className="relative flex items-center justify-between">
              <Brand light size="sm" />
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-emerald-200/60">FCFA</span>
            </div>
            <p className="relative mt-8 text-sm font-medium text-emerald-100/70">{t("Solde")}</p>
            <p className={cn("relative font-display text-[2.6rem] font-bold leading-none tracking-tight tabular-nums", low && "text-amber-300")}>{money(w.balance)}</p>
            <div className="relative mt-5 grid grid-cols-2 gap-3 border-t border-dashed border-white/20 pt-4 text-sm">
              <div>
                <p className="text-emerald-100/60">{t("Engagé")}</p>
                <p className="font-semibold tabular-nums">{money(w.committed)}</p>
              </div>
              <div>
                <p className="text-emerald-100/60">{t("Disponible")}</p>
                <p className="font-semibold tabular-nums">{money(w.available)}</p>
              </div>
            </div>
            {low && (
              <p className="relative mt-4 inline-flex items-center gap-2 rounded-lg bg-amber-400/15 px-3 py-1.5 text-sm font-medium text-amber-200 ring-1 ring-amber-300/30">
                <TriangleAlert className="size-4" /> {t("Solde bas : pensez à recharger")}
              </p>
            )}
          </div>

          <Card className="anim-rise p-5" style={{ "--d": "80ms" } as React.CSSProperties}>
            <p className="font-display font-semibold text-slate-900">{t("Recharger")}</p>
            <p className="mt-1 text-sm text-slate-500">{t("Crédit immédiat après validation, reçu dans l'historique.")}</p>
            <TopUpButton beneficiaryId={user.id} className="mt-4 w-full" label={t("Wave ou Orange Money")} />
            <div className="mt-4 flex items-start gap-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
              <Store className="mt-0.5 size-4 shrink-0 text-slate-400" />
              <p>{t("Ou en espèces au comptoir de la cantine, en présentant votre pass.")}</p>
            </div>
          </Card>
          <div className="flex gap-3 px-1 text-sm text-slate-500">
            <Info className="mt-0.5 size-4 shrink-0 text-slate-400" />
            <p>{t("La réservation engage le prix du repas ; le débit a lieu au passage en caisse. Une annulation avant l'heure limite libère le montant.")}</p>
          </div>
        </div>

        <Card className="anim-rise" style={{ "--d": "120ms" } as React.CSSProperties}>
          <CardHeader title={t("Historique")} subtitle={t("{count} dernières opérations", { count: w.transactions.length })} icon={<Receipt className="size-4" />} />
          {w.transactions.length === 0 ? (
            <EmptyState icon={<Receipt className="size-6" />} title={t("Aucune opération")}>
              {t("Vos rechargements et repas apparaîtront ici.")}
            </EmptyState>
          ) : (
            <div>
              {[...groups.entries()].map(([label, items]) => (
                <section key={label}>
                  <h3 className="bg-slate-50/70 px-5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</h3>
                  <ul className="divide-y divide-slate-100">
                    {items.map((tx) => {
                      const credit = tx.amount > 0;
                      const Icon = tx.type === "MEAL" ? Utensils : credit ? ArrowDownLeft : ArrowUpRight;
                      return (
                        <li key={tx.id} className="flex items-center gap-3 px-5 py-3">
                          <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", credit ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500")}>
                            <Icon className="size-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-slate-800">{t(tx.label)}</p>
                            <p className="truncate text-xs text-slate-500">
                              {time(tx.createdAt, env.timezone)} · {t(METHODS[tx.method])}
                              {tx.note && ` · ${note(tx.note)}`}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className={cn("font-display text-[15px] font-semibold tabular-nums", credit ? "text-emerald-600" : "text-slate-900")}>
                              {credit ? "+" : "−"}
                              {money(Math.abs(tx.amount))}
                            </p>
                            <p className="text-xs text-slate-500 tabular-nums">{money(tx.balanceAfter)}</p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
