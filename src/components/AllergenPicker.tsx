"use client";

import { Check, Plus } from "lucide-react";
import { ALLERGENS, ALLERGEN_IDS } from "@/lib/constants";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";

export function AllergenPicker({ value, onChange, disabled }: { value: string[]; onChange: (v: string[]) => void; disabled?: boolean }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={t("Allergies")}>
      {ALLERGEN_IDS.map((a) => {
        const on = value.includes(a);
        return (
          <button
            key={a}
            type="button"
            disabled={disabled}
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== a) : [...value, a])}
            className={cn(
              "inline-flex min-h-11 items-center gap-1 rounded-full py-2 pl-2.5 pr-3.5 text-xs font-medium ring-1 ring-inset transition active:scale-[0.96] disabled:opacity-50",
              on ? "bg-red-50 text-red-700 ring-red-300" : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50 hover:ring-slate-300",
            )}
          >
            {on ? <Check className="size-3.5" strokeWidth={2.5} /> : <Plus className="size-3.5 text-slate-400" />}
            {t(ALLERGENS[a].label)}
          </button>
        );
      })}
    </div>
  );
}
