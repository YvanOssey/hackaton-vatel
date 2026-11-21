import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Banknote, BellRing, ChevronRight, ClipboardList, HeartHandshake, Package, Receipt, Smartphone, Star, UserCheck, Utensils } from "lucide-react";
import { Avatar, Card, CardHeader, EmptyState, PageTitle, Stat } from "@/components/ui";
import { cn } from "@/lib/utils";
import { requireUser } from "@/server/auth";
import { env } from "@/server/env";
import { adminDashboard } from "@/server/services/queries";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t("Administration") };
}

export default async function AdminHome() {
  const d = await adminDashboard(await requireUser(["ADMIN"]));
  const { t, money, day, dayInline, time, dec } = await getI18n();
  const expected = d.reservations.reserved + d.reservations.served;
  const max = Math.max(1, ...d.trend.map((x) => x.reserved + x.walkIn));
  const totalMeals = d.trend.reduce((a, x) => a + x.reserved + x.walkIn, 0);
  const totalRevenue = d.trend.reduce((a, x) => a + x.revenue, 0);
  const walkInShare = totalMeals ? Math.round((d.trend.reduce((a, x) => a + x.walkIn, 0) / totalMeals) * 100) : 0;
  const todo = [
    d.pending > 0 && { href: "/admin/comptes?vue=attente", icon: UserCheck, tone: "bg-amber-50 text-amber-700", title: t("{count} inscription(s) à valider", { count: d.pending }), text: t("Vérifier les numéros étudiants") },
    d.lowStock.length > 0 && { href: "/cuisine/stock", icon: Package, tone: "bg-red-50 text-red-700", title: t("{count} article(s) sous le seuil", { count: d.lowStock.length }), text: d.lowStock.map((s) => s.name).join(", ") },
    d.openSessions.length > 0 && { href: "/admin/caisses", icon: Banknote, tone: "bg-sky-50 text-sky-700", title: t("{count} caisse(s) ouverte(s)", { count: d.openSessions.length }), text: t("À clôturer en fin de service") },
  ].filter(Boolean) as { href: string; icon: typeof UserCheck; tone: string; title: string; text: string }[];

  return (
    <>
      <PageTitle eyebrow={t("Administration")} title={t("Service du {day}", { day: dayInline(d.today) })}>
        <Link href="/cuisine" className="inline-flex h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-slate-700 ring-1 ring-inset ring-slate-200 hover:bg-slate-50">
          <ClipboardList className="size-4" /> {t("Commandes du jour")}
        </Link>
      </PageTitle>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label={t("Repas du jour")} value={expected} icon={<Utensils className="size-5" />} tone="success" hint={t("{served} servis · {reserved} attendus", { served: d.reservations.served, reserved: d.reservations.reserved }) + (d.reservations.cancelled ? ` · ${t("{count} annulés", { count: d.reservations.cancelled })}` : "")} />
        <Stat label={t("Ventes du jour")} value={money(d.sales)} icon={<Receipt className="size-5" />} hint={t("{count} repas débités", { count: d.mealCount })} />
        <Stat
          label={t("Rechargements du jour")}
          value={money(d.cashIn + d.onlineIn)}
          icon={<Smartphone className="size-5" />}
          hint={t("{cash:money} espèces · {online:money} Mobile Money", { cash: d.cashIn, online: d.onlineIn })}
        />
        <Stat
          label={t("Satisfaction (30 j)")}
          value={d.satisfaction.average ? `${dec(d.satisfaction.average)}/5` : "—"}
          icon={<Star className="size-5" />}
          tone={d.satisfaction.average && d.satisfaction.average < 3 ? "danger" : "neutral"}
          hint={d.satisfaction.count ? t("{count} avis", { count: d.satisfaction.count }) : t("Pas encore d'avis")}
        />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title={t("Fréquentation sur 14 jours")}
            subtitle={t("{meals} repas servis · {revenue:money} · {share} % sans réservation", { meals: totalMeals, revenue: totalRevenue, share: walkInShare })}
            action={
              <div className="hidden gap-3 text-xs text-slate-500 sm:flex">
                <span className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-sm bg-brand-500" /> {t("Réservés")}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-sm bg-amber-400" /> {t("Sans réservation")}
                </span>
              </div>
            }
          />
          <div className="overflow-x-auto">
            <div className="flex h-56 min-w-[560px] items-end gap-1.5 px-5 pb-4 pt-6">
              {d.trend.map((x) => {
                const total = x.reserved + x.walkIn;
                const isToday = x.date === d.today;
                return (
                  <div key={x.date} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5" title={t("{day} : {reserved} réservés, {walkIn} sans réservation, {revenue:money}", { day: day(x.date), reserved: x.reserved, walkIn: x.walkIn, revenue: x.revenue })}>
                    <span className="text-[11px] font-semibold tabular-nums text-slate-500">{total || ""}</span>
                    <div className="flex w-full max-w-8 flex-col justify-end overflow-hidden rounded-t-md" style={{ height: `${(total / max) * 100}%`, minHeight: total ? 4 : 2 }}>
                      {total === 0 ? (
                        <div className="h-full bg-slate-100" />
                      ) : (
                        <>
                          <div className="bg-amber-400" style={{ height: `${(x.walkIn / total) * 100}%` }} />
                          <div className={cn("flex-1", isToday ? "bg-brand-600" : "bg-brand-500")} />
                        </>
                      )}
                    </div>
                    <span className={cn("text-[10px] font-medium", isToday ? "text-brand-700" : "text-slate-500")}>{day(x.date, { weekday: "narrow", day: "numeric" })}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
        <Card>
          <CardHeader title={t("À traiter")} subtitle={todo.length ? t("Actions en attente") : t("Tout est à jour")} />
          {todo.length === 0 ? (
            <EmptyState icon={<UserCheck className="size-6" />} title={t("Rien à traiter")} />
          ) : (
            <ul className="divide-y divide-slate-100">
              {todo.map((x) => (
                <li key={x.title}>
                  <Link href={x.href} className="group flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50">
                    <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", x.tone)}>
                      <x.icon className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-slate-900">{x.title}</span>
                      <span className="block truncate text-xs text-slate-500">{x.text}</span>
                    </span>
                    <ChevronRight className="size-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-500" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-center gap-2 border-t border-slate-100 px-5 py-3 text-sm text-slate-500">
            <HeartHandshake className="size-4 text-violet-500" /> {t(d.parents > 1 ? "{count} comptes parents actifs" : "{count} compte parent actif", { count: d.parents })}
          </div>
        </Card>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title={t("Caisses ouvertes")} subtitle={t("Sessions en cours")} icon={<Banknote className="size-4" />} />
          {d.openSessions.length === 0 ? (
            <EmptyState icon={<Banknote className="size-6" />} title={t("Aucune caisse ouverte")} />
          ) : (
            <ul className="divide-y divide-slate-100">
              {d.openSessions.map((s) => (
                <li key={s.id} className="flex items-center justify-between px-5 py-3 text-sm">
                  <span className="flex items-center gap-2 font-medium text-slate-800">
                    <span className="relative flex size-2">
                      <span className="anim-ping-soft absolute inset-0 rounded-full bg-brand-500" />
                      <span className="relative size-2 rounded-full bg-brand-500" />
                    </span>
                    {s.cashier.firstName} {s.cashier.lastName}
                  </span>
                  <span className="text-slate-500">
                    {t("depuis {time} · fond {float:money}", { time: time(s.openedAt, env.timezone), float: s.openingFloat })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader title={t("Soldes bas")} subtitle={t("Étudiants sous {amount:money} — prévenus automatiquement, ainsi que leurs parents", { amount: d.lowBalanceThreshold })} icon={<BellRing className="size-4" />} />
          {d.lowBalance.length === 0 ? (
            <EmptyState icon={<BellRing className="size-6" />} title={t("Aucun solde bas")} />
          ) : (
            <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
              {d.lowBalance.map((u) => (
                <li key={u.id}>
                  <Link href={`/admin/comptes/${u.id}`} className="group flex items-center gap-3 px-5 py-2.5 hover:bg-slate-50">
                    <Avatar user={u} size="sm" />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">
                      {u.firstName} {u.lastName}
                    </span>
                    {u.memberRef && <span className="hidden font-mono text-xs text-slate-500 sm:inline">{u.memberRef}</span>}
                    <span className="w-24 text-right text-sm font-semibold tabular-nums text-red-600">{money(u.balance)}</span>
                    <ArrowRight className="size-4 text-slate-300 group-hover:text-slate-500" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
