"use client";

import { useState, useTransition } from "react";
import { LockOpen, TriangleAlert } from "lucide-react";
import { openSessionAction } from "@/app/caisse/actions";
import { useResultToast } from "@/components/toast";
import { Button, Card, Field, inputCls } from "@/components/ui";
import { useI18n } from "@/i18n/client";

export function OpenSession({ today, reservedCount, hasMenu }: { today: string; reservedCount: number; hasMenu: boolean }) {
  const { t, day } = useI18n();
  const [float, setFloat] = useState("");
  const [pending, start] = useTransition();
  const show = useResultToast();
  const value = Number(float.replace(/\s/g, ""));
  return (
    <div className="mx-auto max-w-md py-6">
      <Card className="p-6 sm:p-8">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
          <LockOpen className="size-6" />
        </span>
        <h1 className="mt-4 text-xl font-semibold text-slate-900">{t("Ouvrir la caisse")}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {day(today)} · {t("{count} repas réservés", { count: reservedCount })}
        </p>
        {!hasMenu && (
          <p className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" /> {t("Aucun menu publié aujourd'hui : seuls les rechargements seront possibles.")}
          </p>
        )}
        <form
          className="mt-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => void show(await openSessionAction(value), "Caisse ouverte"));
          }}
        >
          <Field label={t("Fond de caisse (FCFA)")} htmlFor="float" hint={t("Montant en espèces présent dans le tiroir à l'ouverture.")}>
            <input
              id="float"
              inputMode="numeric"
              required
              autoFocus
              value={float}
              onChange={(e) => setFloat(e.target.value.replace(/\D/g, "").slice(0, 8))}
              placeholder="10000…"
              className={inputCls + " text-lg tabular-nums"}
            />
          </Field>
          <Button type="submit" size="lg" className="w-full" disabled={pending}>
            {t("Ouvrir la caisse")}
          </Button>
        </form>
      </Card>
    </div>
  );
}
