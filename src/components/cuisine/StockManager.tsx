"use client";

import { useState, useTransition } from "react";
import { Minus, Package, Plus } from "lucide-react";
import { adjustStockAction, createStockAction } from "@/app/cuisine/actions";
import { useResultToast } from "@/components/toast";
import { Button, Card, CardHeader, EmptyState, Field, inputCls } from "@/components/ui";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/client";

type Item = { id: string; name: string; unit: string; qty: number; minQty: number; perMeal: number };

export function StockManager({ items }: { items: Item[] }) {
  const { t } = useI18n();
  const [pending, start] = useTransition();
  const show = useResultToast();
  const [deltas, setDeltas] = useState<Record<string, string>>({});
  const [form, setForm] = useState({ name: "", unit: "kg", qty: "", minQty: "", perMeal: "0" });

  const adjust = (item: Item, sign: 1 | -1) => {
    const n = Number(deltas[item.id] || 0);
    if (!n) return;
    start(async () => {
      if (show(await adjustStockAction(item.id, sign * n), sign > 0 ? "Entrée en stock" : "Sortie de stock")) setDeltas((d) => ({ ...d, [item.id]: "" }));
    });
  };

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <Card>
        <CardHeader title={t("Articles")} subtitle={t("Les articles avec une consommation par repas sont décomptés à chaque passage en caisse")} icon={<Package className="size-4" />} />
        {items.length === 0 ? (
          <EmptyState icon={<Package className="size-6" />} title={t("Aucun article")}>
            {t("Ajoutez vos premiers articles avec le formulaire.")}
          </EmptyState>
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((s) => {
              const low = s.qty < s.minQty;
              return (
                <li key={s.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                  <div className="min-w-[160px] flex-1">
                    <p className="font-medium text-slate-800">{s.name}</p>
                    <p className="text-xs text-slate-500">
                      {t("Seuil {qty} {unit}", { qty: s.minQty, unit: s.unit })}
                      {s.perMeal > 0 && ` · ${t("{qty} {unit} par repas", { qty: s.perMeal, unit: s.unit })}`}
                    </p>
                  </div>
                  <span className={cn("w-24 text-right font-semibold tabular-nums", low ? "text-red-600" : "text-slate-900")}>
                    {s.qty} {s.unit}
                  </span>
                  <div className="flex items-center gap-1">
                    <input
                      inputMode="numeric"
                      aria-label={t("Quantité pour {name}", { name: s.name })}
                      value={deltas[s.id] ?? ""}
                      onChange={(e) => setDeltas((d) => ({ ...d, [s.id]: e.target.value.replace(/\D/g, "").slice(0, 6) }))}
                      placeholder={t("Qté…")}
                      className={inputCls + " h-9 w-20"}
                    />
                    <Button size="sm" variant="secondary" disabled={pending} onClick={() => adjust(s, -1)} aria-label={t("Sortie")}>
                      <Minus className="size-4" />
                    </Button>
                    <Button size="sm" disabled={pending} onClick={() => adjust(s, 1)} aria-label={t("Entrée")}>
                      <Plus className="size-4" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      <Card className="self-start">
        <CardHeader title={t("Nouvel article")} />
        <form
          className="space-y-4 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const ok = show(
                await createStockAction({ name: form.name, unit: form.unit, qty: Number(form.qty || 0), minQty: Number(form.minQty || 0), perMeal: Number(form.perMeal || 0) }),
                "Article ajouté",
              );
              if (ok) setForm({ name: "", unit: "kg", qty: "", minQty: "", perMeal: "0" });
            });
          }}
        >
          <Field label={t("Désignation")} htmlFor="s-name">
            <input id="s-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("Unité")} htmlFor="s-unit">
              <input id="s-unit" required value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} maxLength={10} className={inputCls} />
            </Field>
            <Field label={t("Quantité")} htmlFor="s-qty">
              <input id="s-qty" inputMode="numeric" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value.replace(/\D/g, "") })} className={inputCls} />
            </Field>
            <Field label={t("Seuil d'alerte")} htmlFor="s-min">
              <input id="s-min" inputMode="numeric" value={form.minQty} onChange={(e) => setForm({ ...form, minQty: e.target.value.replace(/\D/g, "") })} className={inputCls} />
            </Field>
            <Field label={t("Par repas")} htmlFor="s-per">
              <input id="s-per" inputMode="numeric" value={form.perMeal} onChange={(e) => setForm({ ...form, perMeal: e.target.value.replace(/\D/g, "") })} className={inputCls} />
            </Field>
          </div>
          <Button type="submit" disabled={pending}>
            {t("Ajouter")}
          </Button>
        </form>
      </Card>
    </div>
  );
}
