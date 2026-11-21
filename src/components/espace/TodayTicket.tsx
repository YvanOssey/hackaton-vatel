"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { ArrowRight, Check, CircleCheck, Clock, Leaf, QrCode, TriangleAlert, Wallet } from "lucide-react";
import { cancelAction, reserveAction } from "@/app/espace/actions";
import { useResultToast } from "@/components/toast";
import { Button } from "@/components/ui";
import { allergenLabel } from "@/lib/constants";
import { allergenConflicts, minutesOf } from "@/lib/rules";
import { cn } from "@/lib/utils";
import { RateMeal, type Day } from "./MenuWeek";
import { useI18n } from "@/i18n/client";

/** Minutes restantes avant l'heure limite, recalculées chaque minute à partir de l'horloge du serveur */
function useCountdown(nowMinutes: number, cutoff: string) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 60_000)), 15_000);
    return () => clearInterval(id);
  }, []);
  return minutesOf(cutoff) - (nowMinutes + elapsed);
}

const fmtLeft = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}` : `${m} min`);
const params = (b: Day["booking"]) => (b.open ? undefined : b.params);

export function TodayTicket({
  day,
  nextDay,
  cutoff,
  nowMinutes,
  price,
  balance,
  available,
  lowThreshold,
  userAllergens,
  canBook,
}: {
  day: Day | null;
  nextDay: Day | null;
  cutoff: string;
  nowMinutes: number;
  price: number;
  balance: number;
  available: number;
  lowThreshold: number;
  userAllergens: string[];
  canBook: boolean;
}) {
  const { t, day: fmtDay, money } = useI18n();
  const [pending, start] = useTransition();
  const show = useResultToast();
  const left = useCountdown(nowMinutes, cutoff);
  // Après l'heure limite sans réservation, on met en avant le prochain jour ouvert
  const focus = day?.menu && (day.reservation || left > 0) ? day : nextDay?.menu ? nextDay : day;
  const isToday = focus === day;
  const menu = focus?.menu ?? null;
  const reservation = focus?.reservation ?? null;
  const main = menu?.dishes.find((d) => d.course === "MAIN");
  const sides = menu?.dishes.filter((d) => d.course !== "MAIN") ?? [];
  const conflicts = menu ? allergenConflicts(userAllergens, menu.dishes.map((d) => d.allergens)) : [];
  const low = balance < lowThreshold;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      {/* Ticket */}
      <div className="anim-rise relative rounded-3xl bg-emerald-950 text-white shadow-[0_24px_60px_-28px_rgba(2,44,34,0.8)] sm:flex" style={{ "--d": "60ms" } as React.CSSProperties}>
        <div className="bg-grid relative flex-1 overflow-hidden rounded-t-3xl px-6 pb-6 pt-5 sm:rounded-l-3xl sm:rounded-tr-none sm:px-7">
          <div className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full bg-emerald-500/20 blur-3xl" />
          <div className="relative flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300">{focus ? (isToday ? t("Aujourd'hui") : fmtDay(focus.date, { weekday: "long", day: "numeric", month: "long" })) : t("Cette semaine")}</span>
            {reservation?.status === "RESERVED" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-200 ring-1 ring-emerald-300/30">
                <Check className="size-3" strokeWidth={3} /> {t("Réservé")}
              </span>
            )}
            {reservation?.status === "SERVED" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-white ring-1 ring-white/20">
                <CircleCheck className="size-3" /> {t("Servi · bon appétit")}
              </span>
            )}
          </div>
          {menu && main ? (
            <>
              <h2 className="relative mt-3 font-display text-[1.7rem] font-bold leading-tight tracking-tight sm:text-3xl">
                {main.name}
                {main.vegetarian && <Leaf className="ml-2 inline size-5 -translate-y-0.5 text-emerald-300" aria-label={t("Végétarien")} />}
              </h2>
              <p className="relative mt-1.5 text-sm text-emerald-50/70">{sides.map((s) => s.name).join(" · ")}</p>
              {conflicts.length > 0 && (
                <p className="relative mt-3 inline-flex items-center gap-2 rounded-lg bg-red-500/15 px-2.5 py-1.5 text-sm font-medium text-red-200 ring-1 ring-red-400/30">
                  <TriangleAlert className="size-4" /> {t("Contient {list}", { list: conflicts.map((a) => t(allergenLabel(a))).join(", ") })}
                </p>
              )}
            </>
          ) : (
            <>
              <h2 className="relative mt-3 font-display text-2xl font-bold tracking-tight">{t("Pas de menu publié pour l'instant")}</h2>
              <p className="relative mt-1.5 text-sm text-emerald-50/70">{t("La cuisine publie les menus de la semaine à l'avance. Revenez bientôt.")}</p>
            </>
          )}
        </div>

        {/* Talon détachable */}
        <div className="relative flex flex-col justify-center gap-3 rounded-b-3xl bg-emerald-900/60 px-6 py-5 sm:w-64 sm:rounded-r-3xl sm:rounded-bl-none sm:px-6">
          <span className="ticket-cut-light absolute inset-x-5 top-0 sm:inset-x-auto sm:inset-y-5 sm:left-0 sm:top-5 sm:border-l-2 sm:border-t-0 sm:border-dashed sm:border-white/25" aria-hidden />
          {/* Encoches de découpe */}
          <span className="absolute -left-[11px] -top-[11px] size-[22px] rounded-full bg-[var(--page)] sm:hidden" aria-hidden />
          <span className="absolute -right-[11px] -top-[11px] size-[22px] rounded-full bg-[var(--page)] sm:hidden" aria-hidden />
          <span className="absolute -left-[11px] -top-[11px] hidden size-[22px] rounded-full bg-[var(--page)] sm:block" aria-hidden />
          <span className="absolute -bottom-[11px] -left-[11px] hidden size-[22px] rounded-full bg-[var(--page)] sm:block" aria-hidden />
          {menu && reservation?.status === "SERVED" ? (
            <div className="rounded-xl bg-white p-3 text-slate-900">
              <RateMeal reservationId={reservation.id} rating={reservation.rating} compact />
            </div>
          ) : menu && reservation?.status === "RESERVED" ? (
            <>
              <p className="font-display text-2xl font-bold tabular-nums">{money(reservation.price)}</p>
              <Link href="/espace/pass" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white text-sm font-semibold text-emerald-950 transition hover:bg-emerald-50 active:scale-[0.96]">
                <QrCode className="size-4" /> {t("Afficher mon pass")}
              </Link>
              {focus!.booking.open ? (
                <button
                  disabled={pending}
                  onClick={() => start(async () => void show(await cancelAction(reservation.id), "Réservation annulée"))}
                  className="text-xs font-medium text-emerald-100/70 underline-offset-4 hover:text-white hover:underline disabled:opacity-50"
                >
                  {isToday && left > 0 ? t("Annuler (encore {left})", { left: fmtLeft(left) }) : t("Annuler")}
                </button>
              ) : (
                <p className="text-xs text-emerald-100/60">{t("Annulation close")}</p>
              )}
            </>
          ) : menu ? (
            <>
              <p className="font-display text-2xl font-bold tabular-nums">{money(price)}</p>
              {isToday && left > 0 && (
                <p className={cn("flex items-center gap-1.5 text-xs font-medium", left <= 30 ? "text-amber-300" : "text-emerald-100/70")}>
                  <Clock className="size-3.5" /> {t("Encore {left} pour réserver", { left: fmtLeft(left) })}
                </p>
              )}
              <Button
                className="h-11 w-full bg-emerald-400 text-emerald-950 shadow-none hover:bg-emerald-300 active:bg-emerald-300"
                disabled={!focus!.booking.open || !canBook || pending}
                title={!canBook ? t("Compte en attente de validation") : !focus!.booking.open ? t(focus!.booking.reason, params(focus!.booking)) : undefined}
                onClick={() => start(async () => void show(await reserveAction(focus!.date), "Repas réservé"))}
              >
                {!canBook ? t("Validation requise") : !focus!.booking.open ? t(focus!.booking.reason, params(focus!.booking)) : t("Réserver ce repas")}
              </Button>
            </>
          ) : (
            <p className="text-sm text-emerald-100/70">{t("Les réservations ouvrent dès la publication du menu.")}</p>
          )}
        </div>
      </div>

      {/* Portefeuille */}
      <Link
        href="/espace/portefeuille"
        className="anim-rise group relative flex flex-col justify-between overflow-hidden rounded-3xl bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-18px_rgba(15,23,42,0.12)] ring-1 ring-slate-900/[0.06] transition hover:ring-emerald-500/40"
        style={{ "--d": "140ms" } as React.CSSProperties}
      >
        <div className="flex items-center justify-between">
          <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/10">
            <Wallet className="size-5" />
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
            {t("Recharger")} <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
        <div className="mt-6">
          <p className="text-sm font-medium text-slate-500">{t("Solde")}</p>
          <p className={cn("font-display text-[2.1rem] font-bold leading-none tracking-tight tabular-nums", low ? "text-red-600" : "text-slate-900")}>{money(balance)}</p>
          <p className="mt-2 text-sm text-slate-500">
            {t("Disponible pour réserver :")} <strong className="text-slate-800 tabular-nums">{money(available)}</strong>
          </p>
          {low && (
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
              <TriangleAlert className="size-3.5" /> {t("Solde bas")}
            </p>
          )}
        </div>
      </Link>
    </div>
  );
}
