"use client";

import { useState, useTransition } from "react";
import { CalendarX2, Check, CircleCheck, Clock, Flame, Heart, Leaf, Lock, MessageSquareText, TriangleAlert } from "lucide-react";
import type { Course, NutriScore, ReservationStatus } from "@prisma/client";
import { cancelAction, rateMealAction, reserveAction, toggleFavoriteAction } from "@/app/espace/actions";
import { DishPhoto } from "@/components/DishPhoto";
import { PickupChooser } from "./PickupChooser";
import { useResultToast } from "@/components/toast";
import { AllergenChip, Badge, Button, Card, NutriBadge, Segmented, Stars } from "@/components/ui";
import { COURSES, RATING_LABELS, allergenLabel } from "@/lib/constants";
import { allergenConflicts } from "@/lib/rules";
import { matchesFavorite } from "@/lib/dishes";
import { addDays, cn, delay, isoToDate, mondayOf } from "@/lib/utils";
import { useI18n } from "@/i18n/client";
import { rich } from "@/i18n/rich";

type Dish = { id: string; course: Course; name: string; allergens: string[]; kcal: number; vegetarian: boolean; photo?: string | null };
export type Day = {
  date: string;
  menu: { nutriScore: NutriScore; dishes: Dish[] } | null;
  reservation: { id: string; status: ReservationStatus; price: number; walkIn: boolean; pickupSlot: string | null; rating: { score: number; comment: string | null } | null } | null;
  booking: { open: true } | { open: false; reason: string; params?: Record<string, string | number> };
};

type Props = { initialWeek?: "current" | "next"; days: Day[]; today: string; price: number; cutoff: string; userAllergens: string[]; canBook: boolean; favoriteKeys: string[] };

export function MenuWeek(props: Props) {
  const { t } = useI18n();
  const [week, setWeekState] = useState<"current" | "next">(props.initialWeek ?? "current");
  /** La semaine affichée est dans l'URL (?semaine=prochaine) */
  const setWeek = (w: "current" | "next") => {
    setWeekState(w);
    const url = new URL(window.location.href);
    if (w === "next") url.searchParams.set("semaine", "prochaine");
    else url.searchParams.delete("semaine");
    window.history.replaceState(null, "", url);
  };
  const nextMonday = addDays(mondayOf(props.today), 7);
  const days = props.days.filter((d) => (week === "current" ? d.date < nextMonday : d.date >= nextMonday));
  const booked = days.filter((d) => d.reservation?.status === "RESERVED").length;

  return (
    <section className="space-y-4" aria-labelledby="week-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="week-title" className="font-display text-xl font-bold tracking-tight text-slate-900">
            {t("Menus de la semaine")}
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">
            <Clock className="-mt-0.5 mr-1.5 inline size-3.5" />
            {rich(t("Réservation et annulation jusqu'à {time} le jour même"), { time: <strong className="font-semibold text-slate-700">{props.cutoff}</strong> })}
            {booked > 0 && <span className="text-slate-500"> · {t(booked > 1 ? "{count} repas réservés" : "{count} repas réservé", { count: booked })}</span>}
          </p>
        </div>
        <Segmented
          value={week}
          onChange={setWeek}
          options={[
            { value: "current", label: t("Cette semaine") },
            { value: "next", label: t("Semaine prochaine") },
          ]}
        />
      </div>
      <div key={week} className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {days.map((d, i) => (
          <div key={d.date} className="anim-rise" style={delay(i * 50)}>
            <DayCard day={d} {...props} />
          </div>
        ))}
      </div>
    </section>
  );
}

function DayCard({ day, today, price, userAllergens, canBook, favoriteKeys }: { day: Day } & Props) {
  const { t, day: fmtDay, money } = useI18n();
  const [pending, start] = useTransition();
  const show = useResultToast();
  const { menu, reservation, booking } = day;
  const conflicts = menu
    ? allergenConflicts(
        userAllergens,
        menu.dishes.map((x) => x.allergens),
      )
    : [];
  const isToday = day.date === today;
  const past = day.date < today;
  const d = isoToDate(day.date);
  const weekday = fmtDay(day.date, { weekday: "long" });
  const month = fmtDay(day.date, { month: "short" }).replace(".", "");
  const reason = booking.open ? "" : t(booking.reason, booking.params);
  // Couverture : photo du plat principal, sinon la première disponible
  const cover = menu ? (menu.dishes.find((x) => x.course === "MAIN" && x.photo) ?? menu.dishes.find((x) => x.photo)) : undefined;

  const status =
    reservation?.status === "SERVED" ? (
      <Badge tone="success">
        <CircleCheck className="size-3" /> {t("Servi")}
      </Badge>
    ) : reservation?.status === "RESERVED" ? (
      <Badge tone="brand">
        <Check className="size-3" strokeWidth={3} /> {t("Réservé")}
      </Badge>
    ) : !menu ? null : booking.open ? (
      <Badge tone="info">{t("Ouvert")}</Badge>
    ) : (
      <Badge>{t("Fermé")}</Badge>
    );

  return (
    <Card
      className={cn(
        "flex h-full flex-col overflow-hidden transition-shadow hover:shadow-[0_1px_2px_rgba(15,23,42,0.04),0_18px_40px_-20px_rgba(15,23,42,0.2)]",
        isToday && "ring-2 ring-brand-500/70",
        past && !reservation && "opacity-70",
      )}
    >
      <div className="flex items-center gap-3 px-5 pb-3 pt-4">
        <div className={cn("flex size-12 shrink-0 flex-col items-center justify-center rounded-xl leading-none", isToday ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-700")}>
          <span className="font-display text-lg font-bold">{d.getUTCDate()}</span>
          <span className={cn("text-[10px] font-semibold uppercase", isToday ? "text-brand-100" : "text-slate-500")}>{month}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display font-semibold capitalize text-slate-900">{weekday}</p>
          <p className={cn("text-xs", isToday ? "font-semibold text-brand-700" : "text-slate-500")}>
            {isToday ? t("Aujourd'hui") : past ? t("Passé") : menu ? money(reservation?.price ?? price) : "—"}
          </p>
        </div>
        {status}
      </div>

      {menu ? (
        <>
          {cover?.photo && (
            <div className="px-4 pb-3">
              <DishPhoto dish={{ ...cover, photo: cover.photo }} className="aspect-[16/9] w-full rounded-xl">
                <span className="absolute bottom-2 left-2 rounded-full bg-brand-950/75 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">{t(COURSES[cover.course])}</span>
              </DishPhoto>
            </div>
          )}
          <ul className="flex-1 space-y-3 px-5 pb-4 pt-1">
            {menu.dishes.map((dish) => (
              <li key={dish.id} className={cn("flex items-start gap-3", dish.course === "MAIN" && "rounded-xl bg-slate-50 px-3 py-2.5 -mx-3")}>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">{t(COURSES[dish.course])}</p>
                  <p className={cn("mt-0.5 flex items-center gap-1.5 text-slate-800", dish.course === "MAIN" ? "font-display text-[15px] font-semibold" : "text-sm font-medium")}>
                    {dish.name}
                    {dish.vegetarian && <Leaf className="size-3.5 shrink-0 text-brand-600" aria-label={t("Végétarien")} />}
                    <FavoriteHeart name={dish.name} on={favoriteKeys.some((k) => matchesFavorite(dish.name, k))} />
                  </p>
                  {dish.allergens.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {dish.allergens.map((a) => (
                        <AllergenChip key={a} id={a} highlight={userAllergens.includes(a)} />
                      ))}
                    </div>
                  )}
                </div>
                {/* Vignette des autres plats (la couverture montre déjà le sien) */}
                {dish.photo && dish !== cover && <DishPhoto dish={{ ...dish, photo: dish.photo }} className="size-12 shrink-0 rounded-lg ring-1 ring-slate-900/[0.06]" />}
              </li>
            ))}
            <li className="flex items-center gap-2 pt-0.5">
              <NutriBadge score={menu.nutriScore} />
              <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                <Flame className="size-3.5" />
                {menu.dishes.reduce((s, x) => s + x.kcal, 0)} kcal
              </span>
            </li>
          </ul>
          {conflicts.length > 0 && reservation?.status !== "SERVED" && (
            <div className="mx-5 mb-3 flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-inset ring-red-200">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              <span>{rich(t("Contient : {list} — signalé en caisse."), { list: <strong>{conflicts.map((a) => t(allergenLabel(a))).join(", ")}</strong> })}</span>
            </div>
          )}
          <div className="ticket-cut mx-4" />
          <div className="px-5 py-3">
            {reservation?.status === "SERVED" ? (
              <RateMeal reservationId={reservation.id} rating={reservation.rating} />
            ) : reservation?.status === "RESERVED" ? (
              <div className="space-y-2">
                <PickupChooser reservationId={reservation.id} date={day.date} slot={reservation.pickupSlot} disabled={!booking.open || pending} />
                <Button
                  variant="danger"
                  className="w-full"
                  disabled={!booking.open || pending}
                  title={!booking.open ? reason : undefined}
                  onClick={() => start(async () => void show(await cancelAction(reservation.id), "Réservation annulée"))}
                >
                  {booking.open ? (
                    t("Annuler la réservation")
                  ) : (
                    <>
                      <Lock className="size-4" /> {t("Annulation close")}
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <Button
                className="w-full"
                disabled={!booking.open || !canBook || pending}
                title={!booking.open ? reason : !canBook ? t("Compte en attente de validation") : undefined}
                onClick={() => start(async () => void show(await reserveAction(day.date), "Repas réservé"))}
              >
                {!booking.open ? (
                  <>
                    <Lock className="size-4" /> {reason}
                  </>
                ) : !canBook ? (
                  t("Validation du compte requise")
                ) : (
                  t("Réserver · {price:money}", { price })
                )}
              </Button>
            )}
          </div>
        </>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-5 pb-8 pt-4 text-center text-slate-500">
          <CalendarX2 className="size-7" />
          <p className="text-sm">{past ? t("Pas de service") : t("Menu bientôt publié")}</p>
        </div>
      )}
    </Card>
  );
}

/** Note du repas servi : étoiles puis commentaire facultatif */
export function RateMeal({ reservationId, rating, compact }: { reservationId: string; rating: { score: number; comment: string | null } | null; compact?: boolean }) {
  const { t } = useI18n();
  const [score, setScore] = useState(rating?.score ?? 0);
  const [comment, setComment] = useState(rating?.comment ?? "");
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const show = useResultToast();

  const save = (s: number, c = comment) =>
    start(async () => {
      if (show(await rateMealAction(reservationId, s, c.trim() || undefined), "Avis enregistré")) setEditing(false);
    });

  if (rating && !editing) {
    return (
      <div className="flex min-h-10 items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm text-slate-600">
          <Stars value={rating.score} size="sm" /> {t(RATING_LABELS[rating.score])}
        </span>
        <button onClick={() => setEditing(true)} className="hit text-xs font-semibold text-brand-700 hover:underline">
          {t("Modifier")}
        </button>
      </div>
    );
  }
  return (
    <div className={cn("space-y-2", compact && "space-y-1.5")}>
      <div className="flex min-h-10 flex-wrap items-center justify-between gap-x-2">
        <span className="whitespace-nowrap text-sm font-medium text-slate-700">{score ? t(RATING_LABELS[score]) : t("Votre avis ?")}</span>
        {/* Étoiles de 44 px : la marge négative aligne les étoiles sur les bords sans réduire la zone tactile */}
        <span className="-mx-2.5">
          <Stars value={score} onChange={(v) => setScore(v)} label={t("Noter ce repas")} />
        </span>
      </div>
      {score > 0 && (
        <div className="flex gap-2 [animation:fade-in_200ms_ease-out]">
          <label className="relative flex-1">
            <span className="sr-only">{t("Commentaire (facultatif)")}</span>
            <MessageSquareText className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={280}
              placeholder={t("Un mot pour la cuisine…")}
              className="h-9 w-full rounded-lg bg-white pl-9 pr-3 text-sm ring-1 ring-inset ring-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </label>
          <Button size="sm" className="h-9" disabled={pending} onClick={() => save(score)}>
            {t("Envoyer")}
          </Button>
        </div>
      )}
    </div>
  );
}

/** Cœur d'un plat : l'étudiant reçoit une alerte quand ce plat revient au menu */
function FavoriteHeart({ name, on }: { name: string; on: boolean }) {
  const { t } = useI18n();
  const [pending, start] = useTransition();
  const show = useResultToast();
  return (
    <button
      type="button"
      disabled={pending}
      aria-pressed={on}
      aria-label={t(on ? "Retirer {dish} de mes plats préférés" : "Ajouter {dish} à mes plats préférés", { dish: name })}
      title={t(on ? "Plat préféré" : "Ajouter à mes plats préférés")}
      onClick={() => start(async () => void show(await toggleFavoriteAction(name), on ? "Plat retiré des préférés" : "Plat préféré ajouté"))}
      className="hit ml-auto shrink-0 rounded-full p-1 transition-transform active:scale-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:opacity-50"
    >
      <Heart className={cn("size-4 transition-colors", on ? "fill-brand-600 text-brand-600" : "text-slate-400 hover:text-brand-600")} />
    </button>
  );
}
