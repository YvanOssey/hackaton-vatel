"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LogoMark } from "@/components/brand";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";

const v = (vars: Record<string, string | number>) => vars as React.CSSProperties;
const WORD = ["C", "a", "n", "t", "i", "n", "e"];
const WORD2 = ["C", "o", "n", "n", "e", "c", "t"];
const HOLD = 2350; // durée avant la sortie
const EXIT = 650; // durée du dévoilement
const SEEN_KEY = "cc-splash-vu";

/**
 * Ouverture : le logo-ticket apparaît, le nom s'écrit, puis un ticket du jour « s'imprime ».
 * La sortie dévoile l'écran suivant par un cercle de la couleur des pages de l'application.
 */
export function Splash({ target, dateLabel, establishment }: { target: string; dateLabel: string; establishment: string }) {
  const router = useRouter();
  const { t } = useI18n();
  const [leaving, setLeaving] = useState(false);
  const done = useRef(false);

  const go = (instant = false) => {
    if (done.current) return;
    done.current = true;
    if (instant) return router.replace(target);
    setLeaving(true);
    setTimeout(() => router.replace(target), EXIT - 120);
  };

  useEffect(() => {
    router.prefetch(target);
    // Une seule fois par session : les ouvertures suivantes de « / » mènent directement à l'espace
    let seen = false;
    try {
      seen = sessionStorage.getItem(SEEN_KEY) === "1";
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch {
      // stockage indisponible (navigation privée stricte) : on garde l'animation
    }
    if (seen) {
      go(true);
      return;
    }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const id = setTimeout(() => go(reduced), reduced ? 600 : HOLD);
    const onKey = (e: KeyboardEvent) => ["Enter", " ", "Escape"].includes(e.key) && go();
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(id);
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, target]);

  return (
    <main
      onClick={() => go()}
      className="relative flex min-h-dvh cursor-pointer select-none flex-col items-center justify-center overflow-hidden bg-emerald-950 text-white"
      aria-label={t("Ouverture de CantineConnect — touchez pour continuer")}
    >
      {/* Fond : grille fine et halo */}
      <div className="bg-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black_10%,transparent_70%)]" aria-hidden />
      <div className="pointer-events-none absolute left-1/2 top-1/2 size-[42rem] -translate-x-1/2 -translate-y-[60%] rounded-full bg-emerald-500/15 blur-3xl" aria-hidden />

      <div className={cn("relative flex flex-col items-center transition-[transform,opacity] duration-500 ease-[var(--ease-out-expo)]", leaving && "-translate-y-6 scale-[0.97] opacity-0")}>
        {/* Logo + ondes */}
        <div className="relative">
          <span className="absolute inset-0 rounded-[28%] bg-emerald-400/40 [animation:ping-soft_1.6s_var(--ease-out-expo)_380ms_2]" aria-hidden />
          <div className="[animation:pop_700ms_var(--ease-spring)_both]">
            <LogoMark animated className="size-20 drop-shadow-[0_18px_40px_rgba(16,185,129,0.45)] sm:size-24" />
          </div>
        </div>

        {/* Nom */}
        <h1 className="mt-7 flex font-display text-[2.6rem] font-bold leading-none tracking-tight sm:text-6xl" aria-label="CantineConnect" translate="no">
          {WORD.map((l, i) => (
            <span key={`a${i}`} className="anim-rise" style={v({ "--d": `${520 + i * 45}ms` })} aria-hidden>
              {l}
            </span>
          ))}
          {WORD2.map((l, i) => (
            <span key={`b${i}`} className="anim-rise text-emerald-300" style={v({ "--d": `${835 + i * 45}ms` })} aria-hidden>
              {l}
            </span>
          ))}
        </h1>
        <p className="anim-fade mt-3 text-sm text-emerald-100/70 sm:text-base" style={v({ "--d": "1100ms" })}>
          {establishment}
        </p>

        {/* Ticket du jour qui sort de « l'imprimante » */}
        <div className="mt-9 w-72 sm:w-80">
          <div className="h-1.5 rounded-full bg-emerald-900 shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]" aria-hidden />
          <div className="-mt-0.5 overflow-hidden px-3 pb-6">
            <div className="ticket rounded-b-2xl bg-white text-slate-900 shadow-[0_24px_50px_-12px_rgba(0,0,0,0.55)] [--cut:58%] [--notch:var(--color-emerald-950)] [animation:print_900ms_var(--ease-out-expo)_1150ms_both]">
              <div className="px-5 pb-3 pt-4">
                <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">
                  <span>{t("Ticket du jour")}</span>
                  <span>{t("N° 001")}</span>
                </div>
                <p className="mt-1.5 font-display text-lg font-semibold">{dateLabel}</p>
              </div>
              <div className="ticket-cut mx-4" />
              <div className="px-5 pb-4 pt-3">
                <div className="flex justify-between text-xs font-medium text-slate-500">
                  <span>{t("Réservez")}</span>
                  <span className="text-slate-300">•</span>
                  <span>{t("Payez")}</span>
                  <span className="text-slate-300">•</span>
                  <span>{t("Savourez")}</span>
                </div>
                <div className="mt-3 h-1 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full origin-left rounded-full bg-emerald-500 [animation:grow_1300ms_cubic-bezier(0.65,0,0.35,1)_1250ms_both]" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <p className={cn("anim-fade absolute bottom-6 text-xs text-emerald-100/40 transition-opacity", leaving && "opacity-0")} style={v({ "--d": "1600ms" })}>
        {t("Touchez pour continuer")}
      </p>

      {/* Dévoilement de l'écran suivant */}
      <div
        className="pointer-events-none fixed inset-0 bg-[var(--page)] transition-[clip-path] ease-[cubic-bezier(0.7,0,0.2,1)]"
        style={{ clipPath: leaving ? "circle(150% at 50% 42%)" : "circle(0% at 50% 42%)", transitionDuration: `${EXIT}ms` }}
        aria-hidden
      />

    </main>
  );
}
