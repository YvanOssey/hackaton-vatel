"use client";

import { useState, useTransition } from "react";
import { Banknote, Clock, Save } from "lucide-react";
import { updateSettingsAction } from "@/app/admin/actions";
import { useResultToast } from "@/components/toast";
import { Button, Card, CardHeader, Field, inputCls } from "@/components/ui";
import { useI18n } from "@/i18n/client";

type S = {
  establishmentName: string;
  cutoffTime: string;
  bookingHorizonDays: number;
  lowBalanceThreshold: number;
  allowWalkIn: boolean;
  priceStudent: number;
};

export function SettingsForm({ initial }: { initial: S }) {
  const { t } = useI18n();
  const [s, setS] = useState(initial);
  const [pending, start] = useTransition();
  const show = useResultToast();
  const num = (k: keyof S) => (e: React.ChangeEvent<HTMLInputElement>) => setS({ ...s, [k]: Number(e.target.value.replace(/\D/g, "").slice(0, 7)) || 0 });

  return (
    <form
      className="grid grid-cols-1 max-w-4xl gap-5 md:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => void show(await updateSettingsAction(s), "Paramètres enregistrés"));
      }}
    >
      <Card>
        <CardHeader title={t("Prix du repas")} subtitle={t("Tarif étudiant (FCFA). Les réservations existantes gardent leur tarif.")} icon={<Banknote className="size-4" />} />
        <div className="p-5">
          <label className="flex items-center justify-between gap-4">
            <span className="text-sm font-medium text-slate-700">{t("Repas complet")}</span>
            <span className="relative w-40">
              <input inputMode="numeric" value={String(s.priceStudent)} onChange={num("priceStudent")} className={inputCls + " pr-14 tabular-nums"} aria-label={t("Prix du repas en FCFA")} />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">FCFA</span>
            </span>
          </label>
        </div>
      </Card>
      <Card>
        <CardHeader title={t("Règles de service")} icon={<Clock className="size-4" />} />
        <div className="space-y-4 p-5">
          <Field label={t("Nom de l'établissement")} htmlFor="name">
            <input id="name" value={s.establishmentName} onChange={(e) => setS({ ...s, establishmentName: e.target.value })} maxLength={80} className={inputCls} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("Heure limite (jour J)")} htmlFor="cutoff">
              <input id="cutoff" type="time" value={s.cutoffTime} onChange={(e) => setS({ ...s, cutoffTime: e.target.value })} className={inputCls} />
            </Field>
            <Field label={t("Réservable à l'avance")} htmlFor="horizon" hint={t("En jours")}>
              <input id="horizon" inputMode="numeric" value={String(s.bookingHorizonDays)} onChange={num("bookingHorizonDays")} className={inputCls} />
            </Field>
          </div>
          <Field label={t("Seuil de solde bas (FCFA)")} htmlFor="low">
            <input id="low" inputMode="numeric" value={String(s.lowBalanceThreshold)} onChange={num("lowBalanceThreshold")} className={inputCls} />
          </Field>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-slate-50 p-3 text-sm">
            <input type="checkbox" checked={s.allowWalkIn} onChange={(e) => setS({ ...s, allowWalkIn: e.target.checked })} className="mt-0.5 size-4 accent-brand-600" />
            <span>
              <span className="font-medium text-slate-800">{t("Autoriser les repas sans réservation")}</span>
              <span className="block text-slate-500">{t("Servis au tarif normal, signalés en orange en caisse.")}</span>
            </span>
          </label>
        </div>
      </Card>
      <div className="md:col-span-2">
        <Button type="submit" disabled={pending}>
          <Save className="size-4" /> {t("Enregistrer")}
        </Button>
      </div>
    </form>
  );
}
