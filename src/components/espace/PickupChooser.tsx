"use client";

import { useState, useTransition } from "react";
import { ShoppingBag, Utensils } from "lucide-react";
import { pickupSlotsAction, setPickupAction } from "@/app/espace/actions";
import { useResultToast } from "@/components/toast";
import { Modal, Skeleton } from "@/components/ui";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/client";

/**
 * Repas à emporter : l'étudiant choisit un créneau de retrait de 15 minutes.
 * Il passe prendre son plateau à l'heure dite, sans faire la queue du service sur place.
 */
export function PickupChooser({ reservationId, date, slot, disabled }: { reservationId: string; date: string; slot: string | null; disabled?: boolean }) {
  const { t } = useI18n();
  const show = useResultToast();
  const [open, setOpen] = useState(false);
  const [slots, setSlots] = useState<{ slot: string; left: number }[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const openModal = () => {
    setOpen(true);
    setSlots(null);
    setError(null);
    start(async () => {
      const res = await pickupSlotsAction(date);
      if (res.ok) setSlots(res.data);
      else setError(res.message);
    });
  };

  const choose = (value: string | null) =>
    start(async () => {
      if (show(await setPickupAction(reservationId, value), value ? "Créneau de retrait choisi" : "Repas sur place")) setOpen(false);
    });

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={openModal}
        className={cn(
          "hit flex min-h-10 w-full items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold ring-1 ring-inset transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:opacity-50",
          slot ? "bg-brand-50 text-brand-800 ring-brand-600/20" : "text-slate-600 ring-slate-200 hover:bg-slate-50",
        )}
      >
        <ShoppingBag className="size-4" />
        {slot ? t("À emporter · retrait à {time}", { time: slot }) : t("Je préfère emporter mon repas")}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={t("Créneau de retrait")}>
        <p className="text-sm text-slate-600">{t("Passez prendre votre plateau à l'heure choisie, sans faire la queue.")}</p>
        {error && (
          <p className="mt-4 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {slots
            ? slots.map((s) => {
                const full = s.left === 0 && s.slot !== slot;
                return (
                  <button
                    key={s.slot}
                    type="button"
                    disabled={full || pending}
                    aria-pressed={s.slot === slot}
                    onClick={() => choose(s.slot)}
                    className={cn(
                      "flex min-h-14 flex-col items-center justify-center rounded-xl text-sm ring-1 ring-inset transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600",
                      s.slot === slot ? "bg-brand-950 font-semibold text-white ring-brand-950" : full ? "cursor-not-allowed bg-slate-50 text-slate-400 ring-slate-200" : "text-slate-800 ring-slate-200 hover:bg-brand-50",
                    )}
                  >
                    <span className="font-semibold tabular-nums">{s.slot}</span>
                    <span className={cn("text-[11px]", s.slot === slot ? "text-brand-200" : "text-slate-500")}>{full ? t("Complet") : t("{count} place(s)", { count: s.left })}</span>
                  </button>
                );
              })
            : !error && Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
        </div>
        {slot && (
          <button type="button" disabled={pending} onClick={() => choose(null)} className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900">
            <Utensils className="size-4" /> {t("Finalement, je mange sur place")}
          </button>
        )}
      </Modal>
    </>
  );
}
