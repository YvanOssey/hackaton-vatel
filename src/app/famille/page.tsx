import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDownLeft, CalendarCheck2, CalendarClock, CircleCheck, Clock3, HeartHandshake, Leaf, Plus, Receipt, TriangleAlert, Utensils } from "lucide-react";
import { LinkChildForm } from "@/components/famille/LinkChildForm";
import { UnlinkChild } from "@/components/famille/UnlinkChild";
import { PushCard } from "@/components/push/PushControls";
import { pushPublicKey } from "@/server/push";
import { TopUpButton } from "@/components/payments/TopUpFlow";
import { AllergenChip, Avatar, Badge, Card, EmptyState, PageTitle, Stars } from "@/components/ui";
import { COURSES, METHODS } from "@/lib/constants";
import { cn, elides } from "@/lib/utils";
import type { I18n } from "@/i18n/core";
import { requireUser } from "@/server/auth";
import { env } from "@/server/env";
import { familyOverview } from "@/server/services/queries";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t("Suivi des repas") };
}

type Child = Awaited<ReturnType<typeof familyOverview>>["children"][number];

export default async function FamilyPage() {
  const user = await requireUser(["PARENT"]);
  const data = await familyOverview(user);
  const i18n = await getI18n();
  const { t } = i18n;

  if (data.children.length === 0) {
    return (
      <>
        <PageTitle eyebrow={t("Espace parent")} title={t("Bienvenue {name}", { name: user.firstName })} />
        <div className="mx-auto max-w-lg">
          <Card className="anim-rise overflow-hidden">
            <div className="bg-grid relative bg-brand-950 px-6 py-8 text-center text-white">
              <span className="relative mx-auto flex size-14 items-center justify-center rounded-2xl bg-brand-400/15 text-brand-300 ring-1 ring-brand-300/30">
                <HeartHandshake className="size-7" />
              </span>
              <p className="relative mt-4 font-display text-xl font-bold">{t("Associez le compte de votre enfant")}</p>
              <p className="relative mt-1 text-sm text-brand-50/70">{t("Demandez-lui le code généré depuis son profil CantineConnect.")}</p>
            </div>
            <div className="p-6">
              <LinkChildForm />
              <Link href="/famille/associer" className="mt-4 block text-center text-sm font-medium text-brand-700 hover:underline">
                {t("Comment obtenir le code ?")}
              </Link>
            </div>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      <PageTitle eyebrow={t("Espace parent")} title={data.children.length === 1 ? (elides(data.children[0].firstName) ? t("Les repas d'{name}", { name: data.children[0].firstName }) : t("Les repas de {name}", { name: data.children[0].firstName })) : t("Les repas de vos enfants")}>
        <Link href="/famille/associer" className="inline-flex h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-slate-700 ring-1 ring-inset ring-slate-200 hover:bg-slate-50">
          <Plus className="size-4" /> {t("Associer un enfant")}
        </Link>
      </PageTitle>
      <div className="space-y-6">
        {data.children.map((c, i) => (
          <ChildPanel key={c.id} child={c} today={data.today} threshold={data.lowBalanceThreshold} index={i} i18n={i18n} />
        ))}
        <div className="anim-rise max-w-2xl" style={{ "--d": "200ms" } as React.CSSProperties}>
          <PushCard publicKey={pushPublicKey()} audience="parent" />
        </div>
      </div>
    </>
  );
}

function ChildPanel({ child: c, today, threshold, index, i18n }: { child: Child; today: string; threshold: number; index: number; i18n: I18n }) {
  const { t, money, day, dateTime } = i18n;
  const main = c.today.menu?.dishes.find((d) => d.course === "MAIN");
  const todayState =
    c.today.status === "SERVED"
      ? { icon: CircleCheck, tone: "bg-brand-50 text-brand-700 ring-brand-600/15", text: "A déjeuné aujourd'hui" }
      : c.today.status === "RESERVED"
        ? { icon: CalendarCheck2, tone: "bg-sky-50 text-sky-700 ring-sky-600/15", text: "Repas réservé aujourd'hui" }
        : c.today.menu
          ? { icon: Clock3, tone: "bg-slate-100 text-slate-600 ring-slate-500/10", text: "Pas de réservation aujourd'hui" }
          : { icon: Clock3, tone: "bg-slate-100 text-slate-600 ring-slate-500/10", text: "Pas de service aujourd'hui" };

  return (
    <section className="anim-rise" style={{ "--d": `${index * 90}ms` } as React.CSSProperties} aria-label={`${c.firstName} ${c.lastName}`}>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,22rem)_1fr]">
        {/* Identité + solde */}
        <div className="relative self-start overflow-hidden rounded-3xl bg-brand-950 p-5 text-white shadow-[0_24px_60px_-28px_rgba(29,29,27,0.8)]">
          <div className="bg-grid pointer-events-none absolute inset-0 [mask-image:linear-gradient(160deg,black,transparent_70%)]" />
          <div className="relative flex items-center gap-3">
            <Avatar user={c} size="lg" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-xl font-bold">
                {c.firstName} {c.lastName}
              </p>
              <p className="font-mono text-xs text-brand-100/60">{c.memberRef ? t("N° {ref}", { ref: c.memberRef }) : t("Étudiant")}</p>
            </div>
            {c.status === "PENDING" && <Badge tone="warning">{t("En validation")}</Badge>}
          </div>
          <div className="relative mt-6">
            <p className="text-sm text-brand-100/70">{t("Solde")}</p>
            <p className={cn("font-display text-4xl font-bold leading-none tracking-tight tabular-nums", c.low && "text-amber-300")}>{money(c.balance)}</p>
            <p className="mt-2 text-sm text-brand-100/70">
              {t("Disponible :")} <span className="font-semibold text-white tabular-nums">{money(c.available)}</span>
              {c.committed > 0 && <span> · {t("{amount:money} engagés", { amount: c.committed })}</span>}
            </p>
            {c.low && (
              <p className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-amber-400/15 px-2.5 py-1 text-xs font-semibold text-amber-200 ring-1 ring-amber-300/30">
                <TriangleAlert className="size-3.5" /> {t("Sous le seuil de {amount:money}", { amount: threshold })}
              </p>
            )}
          </div>
          <TopUpButton beneficiaryId={c.id} beneficiaryName={c.firstName} className="relative mt-5 h-11 w-full bg-brand-400 text-brand-950 shadow-none hover:bg-brand-300" label={elides(c.firstName) ? t("Recharger le compte d'{name}", { name: c.firstName }) : t("Recharger le compte de {name}", { name: c.firstName })} />
          {c.allergens.length > 0 && (
            <div className="relative mt-5 border-t border-dashed border-white/20 pt-4">
              <p className="text-xs text-brand-100/60">{t("Allergies déclarées")}</p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {c.allergens.map((a) => (
                  <AllergenChip key={a} id={a} highlight />
                ))}
              </div>
            </div>
          )}
          <div className="relative mt-5">
            <UnlinkChild childId={c.id} name={c.firstName} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Aujourd'hui */}
          <Card className="p-5 md:col-span-2">
            <div className="flex flex-wrap items-center gap-3">
              <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset", todayState.tone)}>
                <todayState.icon className="size-3.5" /> {t(todayState.text)}
              </span>
              <span className="text-sm text-slate-500">{day(today)}</span>
            </div>
            {main ? (
              <p className="mt-3 font-display text-xl font-semibold text-slate-900">
                {main.name} {main.vegetarian && <Leaf className="inline size-4 text-brand-600" />}
              </p>
            ) : (
              <p className="mt-3 text-sm text-slate-500">{t("Aucun menu publié aujourd'hui.")}</p>
            )}
            {c.upcoming.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-1.5">
                <CalendarClock className="size-4 text-slate-400" />
                <span className="mr-1 text-xs font-medium text-slate-500">{t("Réservé :")}</span>
                {c.upcoming.map((u) => (
                  <span key={u.id} className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", u.date === today ? "bg-brand-600 text-white" : "bg-brand-50 text-brand-800")}>
                    {day(u.date, { weekday: "short", day: "numeric" })}
                  </span>
                ))}
              </div>
            )}
          </Card>

          {/* Repas récents */}
          <Card>
            <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3.5">
              <Utensils className="size-4 text-brand-600" />
              <h2 className="font-display font-semibold text-slate-900">{(elides(c.firstName) ? t("Ce qu'{name} a mangé", { name: c.firstName }) : t("Ce que {name} a mangé", { name: c.firstName }))}</h2>
            </div>
            {c.meals.length === 0 ? (
              <EmptyState icon={<Utensils className="size-6" />} title={t("Aucun repas pour l'instant")} />
            ) : (
              <ul className="divide-y divide-slate-100">
                {c.meals.map((m) => (
                  <li key={m.id} className="px-5 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-slate-500">{day(m.date, { weekday: "long", day: "numeric", month: "short" })}</p>
                      {m.rating ? <Stars value={m.rating} size="sm" label={t("Noté {score} sur 5 par {name}", { score: m.rating, name: c.firstName })} /> : <span className="text-xs tabular-nums text-slate-500">{money(m.price)}</span>}
                    </div>
                    <p className="mt-0.5 text-sm font-medium text-slate-800">{m.dishes.find((d) => d.course === "MAIN")?.name ?? t("Repas du midi")}</p>
                    <p className="text-xs text-slate-500">
                      {m.dishes
                        .filter((d) => d.course !== "MAIN")
                        .map((d) => t("{course} : {dish}", { course: t(COURSES[d.course]), dish: d.name }))
                        .join(" · ")}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Mouvements */}
          <Card>
            <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3.5">
              <Receipt className="size-4 text-brand-600" />
              <h2 className="font-display font-semibold text-slate-900">{t("Mouvements récents")}</h2>
            </div>
            {c.transactions.length === 0 ? (
              <EmptyState icon={<Receipt className="size-6" />} title={t("Aucun mouvement")} />
            ) : (
              <ul className="divide-y divide-slate-100">
                {c.transactions.map((tx) => (
                  <li key={tx.id} className="flex items-center gap-3 px-5 py-2.5">
                    <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", tx.amount > 0 ? "bg-brand-50 text-brand-600" : "bg-slate-100 text-slate-500")}>
                      {tx.amount > 0 ? <ArrowDownLeft className="size-4" /> : <Utensils className="size-3.5" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800">{t(tx.label)}</p>
                      <p className="text-xs text-slate-500">
                        {dateTime(tx.createdAt, env.timezone)} · {t(METHODS[tx.method])}
                      </p>
                    </div>
                    <span className={cn("text-sm font-semibold tabular-nums", tx.amount > 0 ? "text-brand-600" : "text-slate-900")}>
                      {tx.amount > 0 ? "+" : "−"}
                      {money(Math.abs(tx.amount))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </section>
  );
}
