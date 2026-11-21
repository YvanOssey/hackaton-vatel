import type { Metadata } from "next";
import { Download, Receipt } from "lucide-react";
import { Card, CardHeader, EmptyState, PageTitle, Stat } from "@/components/ui";
import { inputCls } from "@/lib/styles";
import { METHODS, TX_TYPES } from "@/lib/constants";
import { addDays, cn, isIsoDate } from "@/lib/utils";

const D: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };
import { requireUser } from "@/server/auth";
import { env } from "@/server/env";
import { clock } from "@/server/time";
import { ledger } from "@/server/services/queries";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t("Finances") };
}

export default async function FinancesPage({ searchParams }: { searchParams: Promise<{ du?: string; au?: string }> }) {
  const actor = await requireUser(["ADMIN"]);
  const sp = await searchParams;
  const { t, money, day, dateTime, note } = await getI18n();
  const today = clock().today;
  const to = sp.au && isIsoDate(sp.au) ? sp.au : today;
  const from = sp.du && isIsoDate(sp.du) ? sp.du : addDays(to, -6);
  const rows = await ledger(actor, from <= to ? from : to, to);
  const sum = (pred: (r: (typeof rows)[number]) => boolean) => rows.filter(pred).reduce((s, r) => s + r.amount, 0);
  const meals = rows.filter((r) => r.type === "MEAL");

  return (
    <>
      <PageTitle eyebrow={t("Administration")} title={t("Finances")}>
        <form className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-slate-500">
            {t("Du")}
            <input type="date" name="du" defaultValue={from} className={inputCls + " mt-1 h-10 w-40"} />
          </label>
          <label className="text-xs text-slate-500">
            {t("Au")}
            <input type="date" name="au" defaultValue={to} className={inputCls + " mt-1 h-10 w-40"} />
          </label>
          <button className="h-11 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white">{t("Afficher")}</button>
          <a href={`/api/admin/export?du=${from}&au=${to}`} className="inline-flex h-11 items-center gap-1.5 rounded-xl px-4 text-sm font-semibold text-slate-800 ring-1 ring-inset ring-slate-300 hover:bg-slate-50">
            <Download className="size-4" /> CSV
          </a>
        </form>
      </PageTitle>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label={t("Repas vendus")} value={money(-sum((r) => r.type === "MEAL"))} hint={t("{count} repas", { count: meals.length })} />
        <Stat
          label={t("Rechargements")}
          value={money(sum((r) => r.type === "TOPUP"))}
          hint={t("{cash:money} espèces · {online:money} Mobile Money", { cash: sum((r) => r.type === "TOPUP" && r.method === "CASH"), online: sum((r) => r.type === "TOPUP" && r.method === "MOBILE_MONEY") })}
        />
        <Stat label={t("Ajustements admin")} value={money(sum((r) => r.type === "ADJUSTMENT"))} hint={t("{count} opérations", { count: rows.filter((r) => r.type === "ADJUSTMENT").length })} />
        <Stat label={t("Repas sans réservation")} value={meals.filter((r) => r.label.includes("sans réservation")).length} hint={t("Sur la période")} />
      </div>
      <Card className="mt-5">
        <CardHeader title={t("Grand livre")} subtitle={t("{count} écritures du {from} au {to}", { count: rows.length, from: day(from, D), to: day(to, D) })} icon={<Receipt className="size-4" />} />
        {rows.length === 0 ? (
          <EmptyState icon={<Receipt className="size-6" />} title={t("Aucune écriture sur la période")} />
        ) : (
          <div className="max-h-[640px] overflow-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="sticky top-0 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  {["Date", "Usager", "Type", "Mode", "Opérateur", "Montant", "Solde après"].map((h) => (
                    <th key={h} className="px-4 py-3">{t(h)}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 tabular-nums">
                {[...rows].reverse().map((r) => (
                  <tr key={r.id} className="[content-visibility:auto] [contain-intrinsic-size:auto_44px]">
                    <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">{dateTime(r.createdAt, env.timezone)}</td>
                    <td className="px-4 py-2.5 font-medium text-slate-800">{r.user.firstName} {r.user.lastName}</td>
                    <td className="px-4 py-2.5">{t(TX_TYPES[r.type])}{r.note && <span className="block text-xs text-slate-500">{note(r.note)}</span>}</td>
                    <td className="px-4 py-2.5 text-slate-600">{t(METHODS[r.method])}</td>
                    <td className="px-4 py-2.5 text-slate-600">{r.operator ? `${r.operator.firstName} ${r.operator.lastName}` : "—"}</td>
                    <td className={cn("px-4 py-2.5 font-semibold", r.amount > 0 ? "text-emerald-600" : "text-slate-900")}>{r.amount > 0 ? "+" : ""}{money(r.amount)}</td>
                    <td className="px-4 py-2.5 text-slate-600">{money(r.balanceAfter)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
