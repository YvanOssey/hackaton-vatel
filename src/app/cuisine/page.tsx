import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarDays, CheckCircle2, ClipboardList, Leaf, MessageSquareQuote, Package, ShieldAlert, Sparkles, Star } from "lucide-react";
import { Avatar, Badge, Card, CardHeader, EmptyState, PageTitle, Stars, Stat } from "@/components/ui";
import { allergenLabel } from "@/lib/constants";
import { addDays, cn } from "@/lib/utils";
import { requireUser } from "@/server/auth";
import { env } from "@/server/env";
import { kitchenOverview } from "@/server/services/queries";
import { ratingsSummary } from "@/server/services/ratings";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t("Cuisine") };
}

export default async function KitchenPage() {
  const user = await requireUser(["CHEF", "ADMIN"]);
  const [k, ratings, { t, day, dayInline, time, dec }] = await Promise.all([kitchenOverview(user), ratingsSummary(user), getI18n()]);
  const today = k.days.find((d) => d.date === k.today);
  const todayMenu = k.menus.find((m) => m.date === k.today);
  const menuAllergens = new Set(todayMenu?.dishes.flatMap((d) => d.allergens) ?? []);
  const max = Math.max(1, ...k.days.map((d) => Math.max(d.total, d.forecast)));
  const lowStock = k.stock.filter((s) => s.qty < s.minQty);
  const upcoming = k.days.filter((d) => d.date >= k.today);
  const missing = upcoming.filter((d) => !k.menus.some((m) => m.date === d.date && m.status === "PUBLISHED"));
  const next = k.days.find((d) => d.date > k.today);
  const served = k.orders.filter((o) => o.status === "SERVED").length;

  return (
    <>
      <PageTitle eyebrow={t("Cuisine")} title={t("Production du {day}", { day: dayInline(k.today) })}>
        <Link href="/cuisine/menus" className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-brand-700">
          {t("Planifier les menus")} <ArrowRight className="size-4" />
        </Link>
      </PageTitle>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label={t("À préparer aujourd'hui")} value={today?.forecast ?? 0} hint={today?.walkInAvg ? t("{count} réservés + ~{walkIn} sans réservation", { count: today?.total ?? 0, walkIn: today.walkInAvg }) : t("{count} réservés", { count: today?.total ?? 0 })} tone="success" icon={<ClipboardList className="size-5" />} />
        <Stat
          label={next ? t("Prévision {day}", { day: dayInline(next.date, { weekday: "long" }) }) : t("Prévision")}
          value={next?.forecast ?? 0}
          hint={next ? t("{count} réservés à ce jour", { count: next.total }) : "—"}
          icon={<Sparkles className="size-5" />}
        />
        <Stat label={t("Menus à publier")} value={missing.length} hint={missing.length ? t("Prochain : {day}", { day: day(missing[0].date, { weekday: "long", day: "numeric" }) }) : t("Planning complet")} tone={missing.length ? "warning" : "neutral"} icon={<CalendarDays className="size-5" />} />
        <Stat
          label={t("Satisfaction (30 j)")}
          value={ratings.average ? `${dec(ratings.average)}/5` : "—"}
          hint={ratings.count ? t("{count} avis d'étudiants", { count: ratings.count }) : t("Pas encore d'avis")}
          tone={ratings.average && ratings.average < 3 ? "danger" : "neutral"}
          icon={<Star className="size-5" />}
        />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title={t("Couverts : réservés et prévus")} subtitle={t("Deux semaines · la prévision ajoute la moyenne des passages sans réservation (4 dernières semaines)")} />
          <div className="overflow-x-auto">
            <div className="flex h-64 min-w-[560px] items-end gap-2 px-5 pb-4 pt-6">
              {k.days.map((d) => {
                const isToday = d.date === k.today;
                const past = d.date < k.today;
                return (
                  <div key={d.date} className="group flex h-full flex-1 flex-col items-center justify-end gap-1.5" title={t("{day} : {total} réservés, {served} servis, prévision {forecast}", { day: day(d.date), total: d.total, served: d.served, forecast: d.forecast })}>
                    <span className={cn("text-xs font-semibold tabular-nums", isToday ? "text-brand-700" : "text-slate-600")}>{past ? d.total : d.forecast}</span>
                    <div className="relative flex w-full max-w-10 flex-1 items-end">
                      {!past && d.forecast > d.total && (
                        <div className="absolute inset-x-0 bottom-0 rounded-t-md border border-dashed border-brand-400 bg-brand-50" style={{ height: `${(d.forecast / max) * 100}%` }} />
                      )}
                      <div
                        className={cn("relative w-full overflow-hidden rounded-t-md transition-[height] duration-700", isToday ? "bg-brand-300" : past ? "bg-slate-300" : "bg-brand-200")}
                        style={{ height: `${(d.total / max) * 100}%`, minHeight: 3 }}
                      >
                        <div className={cn("absolute inset-x-0 bottom-0", isToday ? "bg-brand-600" : "bg-slate-500")} style={{ height: `${d.total ? (d.served / d.total) * 100 : 0}%` }} />
                      </div>
                    </div>
                    <span className={cn("text-[11px] font-medium", isToday ? "text-brand-700" : "text-slate-500")}>{day(d.date, { weekday: "short", day: "numeric" })}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex flex-wrap gap-4 border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm bg-brand-200" /> {t("Réservés")}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm bg-brand-600" /> {t("Servis")}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm border border-dashed border-brand-400 bg-brand-50" /> {t("Prévision anti-gaspillage")}
            </span>
          </div>
        </Card>
        <Card>
          <CardHeader title={t("Contraintes alimentaires")} subtitle={t("Convives réservés aujourd'hui")} icon={<ShieldAlert className="size-4" />} />
          {k.allergenCounts.length === 0 ? (
            <EmptyState icon={<ShieldAlert className="size-6" />} title={t("Aucune allergie déclarée")} />
          ) : (
            <ul className="divide-y divide-slate-100">
              {k.allergenCounts.map(([a, n]) => (
                <li key={a} className="flex items-center justify-between px-5 py-2.5 text-sm">
                  <span className="flex items-center gap-2 font-medium text-slate-700">
                    {t(allergenLabel(a))}
                    {menuAllergens.has(a) && <Badge tone="danger">{t("dans le menu")}</Badge>}
                  </span>
                  <span className="font-display font-semibold tabular-nums">{n}</span>
                </li>
              ))}
            </ul>
          )}
          {lowStock.length > 0 && (
            <Link href="/cuisine/stock" className="flex items-center gap-2 border-t border-slate-100 px-5 py-3 text-sm font-medium text-red-700 hover:bg-red-50">
              <Package className="size-4" /> {t(lowStock.length > 1 ? "{count} articles sous le seuil : {list}" : "{count} article sous le seuil : {list}", { count: lowStock.length, list: lowStock.map((s) => s.name).join(", ") })}
            </Link>
          )}
        </Card>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Commandes du jour */}
        <Card className="lg:col-span-2">
          <CardHeader
            title={t("Commandes du jour")}
            subtitle={t("{count} couvert(s) · {served} servi(s)", { count: k.orders.length, served })}
            icon={<ClipboardList className="size-4" />}
            action={
              k.orders.length > 0 ? (
                <div className="hidden h-2 w-32 overflow-hidden rounded-full bg-slate-100 sm:block" title={t("{served}/{total} servis", { served, total: k.orders.length })}>
                  <div className="h-full rounded-full bg-brand-500" style={{ width: `${(served / k.orders.length) * 100}%` }} />
                </div>
              ) : undefined
            }
          />
          {k.orders.length === 0 ? (
            <EmptyState icon={<ClipboardList className="size-6" />} title={t("Aucune commande aujourd'hui")}>
              {t("Les réservations apparaissent ici au fil de la matinée.")}
            </EmptyState>
          ) : (
            <ul className="max-h-[26rem] divide-y divide-slate-100 overflow-y-auto">
              {k.orders.map((o) => {
                const risk = o.user.allergens.filter((a) => menuAllergens.has(a));
                return (
                  <li key={o.id} className="flex items-center gap-3 px-5 py-2.5">
                    <Avatar user={o.user} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800">
                        {o.user.lastName.toUpperCase()} {o.user.firstName}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {o.user.memberRef ?? "—"}
                        {risk.length > 0 && <span className="font-semibold text-red-600"> · {t("plateau adapté : {list}", { list: risk.map((a) => t(allergenLabel(a))).join(", ") })}</span>}
                      </p>
                    </div>
                    {o.walkIn && <Badge tone="warning">{t("Sans résa")}</Badge>}
                    {o.status === "SERVED" ? (
                      <span className="flex items-center gap-1 text-xs font-semibold text-brand-700">
                        <CheckCircle2 className="size-4" /> {o.servedAt ? time(o.servedAt, env.timezone) : t("Servi")}
                      </span>
                    ) : (
                      <Badge tone="info">{t("Attendu")}</Badge>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* Avis */}
        <Card>
          <CardHeader title={t("Avis des étudiants")} subtitle={t("30 derniers jours")} icon={<MessageSquareQuote className="size-4" />} />
          {ratings.count === 0 ? (
            <EmptyState icon={<Star className="size-6" />} title={t("Pas encore d'avis")}>
              {t("Les étudiants notent leur repas après le passage en caisse.")}
            </EmptyState>
          ) : (
            <div className="space-y-5 p-5">
              <div className="flex items-center gap-4">
                <p className="font-display text-4xl font-bold tabular-nums text-slate-900">{dec(ratings.average!)}</p>
                <div className="flex-1 space-y-1">
                  {[5, 4, 3, 2, 1].map((s) => (
                    <div key={s} className="flex items-center gap-2 text-[11px] text-slate-500">
                      <span className="w-2 tabular-nums">{s}</span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-amber-400" style={{ width: `${(ratings.distribution[s - 1] / ratings.count) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {ratings.best.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t("Les plus appréciés")}</p>
                  <ul className="mt-2 space-y-1.5">
                    {ratings.best.map((m) => (
                      <li key={m.date} className="flex items-center justify-between gap-2 text-sm">
                        <span className="truncate font-medium text-slate-700">
                          <Leaf className="mr-1 inline size-3 text-brand-500" />
                          {m.main}
                        </span>
                        <span className="shrink-0 tabular-nums text-slate-500">{dec(m.average)} · {m.count}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {ratings.comments.length > 0 && (
                <ul className="space-y-2">
                  {ratings.comments.slice(0, 3).map((c) => (
                    <li key={c.id} className="rounded-xl bg-slate-50 px-3 py-2.5">
                      <div className="flex items-center justify-between">
                        <Stars value={c.score} size="sm" />
                        <span className="text-[11px] text-slate-500">{day(c.date, { day: "numeric", month: "short" })}</span>
                      </div>
                      <p className="mt-1 text-sm text-slate-700">{t("« {text} »", { text: c.comment })}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </Card>
      </div>
      <p className="mt-4 text-xs text-slate-500">{t("Prévision du {day} et des jours suivants mise à jour à chaque réservation.", { day: dayInline(addDays(k.today, 1), { weekday: "long", day: "numeric" }) })}</p>
    </>
  );
}
