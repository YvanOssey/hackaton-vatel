"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setLocaleAction } from "@/app/actions/locale";
import { LOCALES, type Locale } from "@/i18n/config";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";

const NAMES: Record<Locale, string> = { fr: "Français", en: "English" };

/** Bascule FR / EN : la langue est gardée dans un cookie, la page est re-rendue côté serveur */
export function LangSwitch({ tone = "light", className }: { tone?: "light" | "dark"; className?: string }) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const choose = (l: Locale) => {
    if (l === locale) return;
    start(async () => {
      await setLocaleAction(l);
      document.documentElement.lang = l;
      router.refresh();
    });
  };
  return (
    <div
      role="radiogroup"
      aria-label={t("Langue")}
      className={cn(
        "inline-flex items-center rounded-full p-0.5 text-[11px] font-semibold tracking-wide transition-opacity",
        tone === "dark" ? "bg-white/10 ring-1 ring-white/15" : "bg-slate-100 ring-1 ring-slate-200",
        pending && "opacity-60",
        className,
      )}
    >
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          role="radio"
          aria-checked={l === locale}
          title={NAMES[l]}
          lang={l}
          onClick={() => choose(l)}
          className={cn(
            "hit min-w-11 rounded-full px-2.5 py-1 uppercase transition-colors",
            l === locale
              ? tone === "dark"
                ? "bg-white text-emerald-950"
                : "bg-white text-slate-900 shadow-sm"
              : tone === "dark"
                ? "text-emerald-100/70 hover:text-white"
                : "text-slate-500 hover:text-slate-900",
          )}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
