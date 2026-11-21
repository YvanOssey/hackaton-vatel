"use client";

import { useState, useTransition } from "react";
import { closeSessionAction } from "@/app/caisse/actions";
import { useResultToast } from "@/components/toast";
import { Button, Field, Modal, inputCls } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { PosState } from "./PosScreen";
import { useI18n } from "@/i18n/client";

export function CloseSessionModal({ open, onClose, state }: { open: boolean; onClose: () => void; state: PosState }) {
  const { t, money } = useI18n();
  const [counted, setCounted] = useState("");
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const show = useResultToast();
  const value = counted === "" ? null : Number(counted);
  const diff = value === null ? null : value - state.totals.expectedCash;

  return (
    <Modal open={open} onClose={() => !pending && onClose()} title={t("Clôturer la caisse")}>
      <dl className="space-y-2 rounded-2xl bg-slate-50 p-4 text-sm">
        {[
          [t("Fond de caisse"), state.session.openingFloat],
          [t("Espèces encaissées ({count})", { count: state.totals.cashTopupCount }), state.totals.cashIn],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between">
            <dt className="text-slate-600">{k}</dt>
            <dd className="font-medium tabular-nums text-slate-900">{money(v as number)}</dd>
          </div>
        ))}
        <div className="flex justify-between border-t border-slate-200 pt-2">
          <dt className="font-semibold text-slate-900">{t("Espèces attendues")}</dt>
          <dd className="font-semibold tabular-nums text-slate-900">{money(state.totals.expectedCash)}</dd>
        </div>
        <div className="flex justify-between text-xs text-slate-500">
          <dt>{t("Repas débités sur portefeuille (hors espèces)")}</dt>
          <dd className="tabular-nums">
            {state.totals.mealCount} · {money(state.totals.mealTotal)}
          </dd>
        </div>
      </dl>
      <form
        className="mt-5 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (value === null) return;
          start(async () => {
            if (show(await closeSessionAction(value, note), "Caisse clôturée")) onClose();
          });
        }}
      >
        <Field label={t("Espèces comptées dans le tiroir (FCFA)")} htmlFor="counted">
          <input
            id="counted"
            inputMode="numeric"
            required
            value={counted}
            onChange={(e) => setCounted(e.target.value.replace(/\D/g, "").slice(0, 9))}
            className={inputCls + " text-lg tabular-nums"}
          />
        </Field>
        {diff !== null && (
          <p className={cn("rounded-xl px-3 py-2 text-sm font-medium", diff === 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700")}>
            {diff === 0 ? t("Caisse juste") : t("Écart : {sign}{diff:money}", { sign: diff > 0 ? "+" : "", diff })}
          </p>
        )}
        <Field label={diff ? t("Justification de l'écart (obligatoire)") : t("Commentaire (facultatif)")} htmlFor="note">
          <textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500} required={!!diff} className={inputCls + " h-auto py-2.5"} />
        </Field>
        <Button type="submit" size="lg" variant="dark" className="w-full" disabled={pending || value === null}>
          {t("Valider la clôture")}
        </Button>
        <p className="text-center text-xs text-slate-500">{t("Une fois clôturée, la session ne peut plus être modifiée.")}</p>
      </form>
    </Modal>
  );
}
