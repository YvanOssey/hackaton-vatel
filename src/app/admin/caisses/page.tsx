import type { Metadata } from "next";
import { Banknote } from "lucide-react";
import { Badge, Card, CardHeader, EmptyState, PageTitle } from "@/components/ui";
import { cn } from "@/lib/utils";
import { requireUser } from "@/server/auth";
import { env } from "@/server/env";
import { listCashSessions } from "@/server/services/queries";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t("Sessions de caisse") };
}

export default async function CashSessionsPage() {
  const sessions = await listCashSessions(await requireUser(["ADMIN"]));
  const { t, money, dateTime, time } = await getI18n();
  const totalDiff = sessions.reduce((s, x) => s + (x.difference ?? 0), 0);
  return (
    <>
      <PageTitle eyebrow={t("Administration")} title={t("Sessions de caisse")}>
        <p className="text-sm text-slate-600">
          {t("Écart cumulé (100 dernières) :")} <strong className={cn(totalDiff === 0 ? "text-slate-900" : "text-red-600")}>{money(totalDiff)}</strong>
        </p>
      </PageTitle>
      <Card>
        <CardHeader title={t("Historique")} subtitle={t("Fond, espèces encaissées, comptage et écart par session")} icon={<Banknote className="size-4" />} />
        {sessions.length === 0 ? (
          <EmptyState icon={<Banknote className="size-6" />} title={t("Aucune session de caisse")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  {["Caissier", "Ouverture", "Clôture", "Repas", "Fond", "Espèces", "Attendu", "Compté", "Écart", "Commentaire"].map((h) => (
                    <th key={h} className="px-4 py-3">{t(h)}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 tabular-nums">
                {sessions.map((s) => (
                  <tr key={s.id}>
                    <td className="px-4 py-3 font-medium text-slate-800">{s.cashier.firstName} {s.cashier.lastName}</td>
                    <td className="px-4 py-3 text-slate-600">{dateTime(s.openedAt, env.timezone)}</td>
                    <td className="px-4 py-3">{s.closedAt ? <span className="text-slate-600">{time(s.closedAt, env.timezone)}</span> : <Badge tone="success">{t("Ouverte")}</Badge>}</td>
                    <td className="px-4 py-3">{s.totals.mealCount}</td>
                    <td className="px-4 py-3">{money(s.openingFloat)}</td>
                    <td className="px-4 py-3">{money(s.totals.cashIn)}</td>
                    <td className="px-4 py-3">{money(s.expectedCash ?? s.totals.expectedCash)}</td>
                    <td className="px-4 py-3">{s.countedCash === null ? "—" : money(s.countedCash)}</td>
                    <td className={cn("px-4 py-3 font-semibold", s.difference ? "text-red-600" : "text-brand-700")}>{s.difference === null ? "—" : money(s.difference)}</td>
                    <td className="max-w-[220px] truncate px-4 py-3 text-slate-500" title={s.closingNote ?? undefined}>{s.closingNote ?? ""}</td>
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
