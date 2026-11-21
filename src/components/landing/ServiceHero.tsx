"use client";

/**
 * « Le service » : la table 3D reste à l'écran pendant que l'on fait défiler ; la cloche se soulève,
 * l'accueil s'efface et le plat du jour est annoncé. Sans WebGL ou en mouvement réduit, le plat est
 * révélé d'emblée, sans animation liée au défilement.
 */
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const TableScene = dynamic(() => import("./TableScene").then((m) => m.TableScene), { ssr: false });

export type Framing = { rest: number; reveal: number };

/** Hauteur (part de l'écran) où la scène place naturellement la cloche au repos et l'assiette une fois révélée */
const SCENE_CENTER = { rest: 0.48, reveal: 0.48 };

export type ServiceTexts = {
  welcomeKicker: string;
  welcomeTitle: string;
  welcomeLead: string;
  lift: string;
  revealKicker: string;
  dish: string | null;
  sides: string[];
  allergens: string | null;
  empty: string;
  cta: { href: string; label: string };
};

function webglAvailable() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export function ServiceHero({ texts, brand, header }: { texts: ServiceTexts; brand: string; header: React.ReactNode }) {
  const section = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const headerBox = useRef<HTMLDivElement>(null);
  const welcomeBox = useRef<HTMLDivElement>(null);
  const revealBox = useRef<HTMLDivElement>(null);
  const progress = useRef(0);
  /** Décalage vertical de la scène (px, vers le bas) : au repos et cloche levée, mesuré d'après la place du texte */
  const framing = useRef<Framing>({ rest: 0, reveal: 0 });
  const [mode, setMode] = useState<"pending" | "3d" | "static">("pending");
  const [reduced, setReduced] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const r = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setReduced(r);
    setMode(webglAvailable() ? "3d" : "static");
  }, []);

  const scrubbing = mode === "3d" && !reduced;

  // Mobile et tablette : la table se centre dans l'espace libre sous l'accueil, puis l'assiette remonte
  // dans l'espace libre au-dessus du plat annoncé. Mesuré sur le texte réel (longueur, langue, police).
  useEffect(() => {
    const root = stage.current;
    if (!root) return;
    const measure = () => {
      const top = root.getBoundingClientRect().top;
      const h = root.clientHeight;
      const headerBottom = (headerBox.current?.getBoundingClientRect().bottom ?? top) - top;
      const welcomeBottom = (welcomeBox.current?.getBoundingClientRect().bottom ?? top) - top;
      const revealTop = (revealBox.current?.getBoundingClientRect().top ?? top + h) - top;
      const freeBottom = h * 0.93 - 56; // au-dessus du bouton « Soulever la cloche »
      framing.current = {
        rest: (welcomeBottom + 12 + freeBottom) / 2 - h * SCENE_CENTER.rest,
        reveal: (headerBottom + revealTop - 12) / 2 - h * SCENE_CENTER.reveal,
      };
    };
    measure();
    document.fonts?.ready.then(measure).catch(() => {});
    const ro = new ResizeObserver(measure);
    [root, welcomeBox.current, revealBox.current].forEach((n) => n && ro.observe(n));
    return () => ro.disconnect();
  }, [mode]);

  // Avancement du service selon le défilement dans la section (lu par la scène à chaque image)
  useEffect(() => {
    const el = section.current;
    if (!el) return;
    if (!scrubbing) {
      progress.current = 1;
      el.style.setProperty("--p", "1");
      el.dataset.revealed = "true";
      return;
    }
    let raf = 0;
    const update = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const span = Math.max(1, r.height - window.innerHeight);
      const p = Math.min(1, Math.max(0, -r.top / span));
      progress.current = p;
      el.style.setProperty("--p", p.toFixed(3));
      el.dataset.revealed = p > 0.56 ? "true" : "false";
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [scrubbing]);

  const lift = () => {
    const el = section.current;
    if (!el) return;
    const end = el.offsetTop + el.offsetHeight - window.innerHeight;
    window.scrollTo({ top: end, behavior: "smooth" });
  };

  return (
    <section
      ref={section}
      className={cn("relative bg-brand-950 text-white", scrubbing ? "h-[240dvh]" : "h-dvh min-h-[36rem]")}
      style={{ "--p": scrubbing ? 0 : 1 } as React.CSSProperties}
      aria-label={texts.welcomeTitle}
    >
      <div ref={stage} className="sticky top-0 h-dvh min-h-[36rem] overflow-hidden">
        {/* Scène 3D, ou fond statique */}
        {mode === "3d" ? (
          <TableScene
            progress={progress}
            framing={framing}
            reduced={reduced}
            brand={brand}
            onReady={() => setReady(true)}
            onFail={() => setMode("static")}
            className={cn("absolute inset-0 transition-opacity duration-1000", ready ? "opacity-100" : "opacity-0")}
          />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_62%,#2a3a46_0%,#1d1d1b_45%,#1d1d1b_80%)]" aria-hidden />
        )}
        {/* Lisibilité : vignette, haut et bas assombris ; sur grand écran, la colonne de texte à gauche reste sur le noir */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(12,12,11,0.75)_100%)]" aria-hidden />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[42%] bg-gradient-to-b from-[#1d1d1b] via-[#1d1d1b]/80 to-transparent lg:h-40" aria-hidden />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[45%] bg-gradient-to-t from-[#1d1d1b] via-[#1d1d1b]/85 to-transparent lg:h-32" aria-hidden />
        <div className="pointer-events-none absolute inset-y-0 left-0 hidden w-[58%] bg-gradient-to-r from-[#1d1d1b] via-[#1d1d1b]/85 to-transparent lg:block" aria-hidden />

        <div ref={headerBox} className="relative z-10">
          {header}
        </div>

        {/* Textes posés sur la même grille que l'en-tête et le reste du site */}
        <div className="pointer-events-none absolute inset-0 z-10">
          <div className="relative mx-auto h-full max-w-6xl px-5 sm:px-8">
            {/* Accueil : s'efface quand la cloche se soulève */}
            <div ref={welcomeBox} className="absolute inset-x-5 top-[6.5rem] sm:inset-x-8 sm:top-[8rem] lg:right-auto lg:top-1/2 lg:w-[26rem] xl:w-[30rem] lg:-translate-y-1/2">
              <div
                className="text-center [text-shadow:0_1px_18px_rgba(0,0,0,0.8)] lg:text-left [[data-revealed=true]_&]:invisible"
                style={{ opacity: "calc(1 - var(--p) * 3.2)", transform: "translateY(calc(var(--p) * -40px))" } as React.CSSProperties}
              >
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-300 sm:text-[11px] sm:tracking-[0.32em]">{texts.welcomeKicker}</p>
                <h1 className="mt-3 font-display text-[2.6rem] font-medium leading-[0.95] tracking-tight text-balance sm:mt-4 sm:text-6xl xl:text-7xl">{texts.welcomeTitle}</h1>
                <p className="mx-auto mt-4 max-w-xs text-[15px] leading-relaxed text-pretty text-white/85 sm:mt-5 sm:max-w-sm sm:text-base lg:mx-0">{texts.welcomeLead}</p>
                {scrubbing && (
                  <button
                    type="button"
                    onClick={lift}
                    className="hit group pointer-events-auto mt-8 hidden h-11 items-center gap-2 rounded-full border border-white/30 bg-white/5 px-5 text-sm font-medium tracking-wide text-white backdrop-blur-sm transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white lg:inline-flex"
                  >
                    {texts.lift}
                    <ChevronDown className="size-4 transition-transform group-hover:translate-y-0.5" aria-hidden />
                  </button>
                )}
              </div>
            </div>

            {/* Sur mobile, l'invitation à soulever la cloche est en bas, sous la table */}
            {scrubbing && (
              <div className="absolute inset-x-5 bottom-[7%] flex justify-center sm:inset-x-8 lg:hidden [[data-revealed=true]_&]:invisible" style={{ opacity: "calc(1 - var(--p) * 4)" } as React.CSSProperties}>
                <button
                  type="button"
                  onClick={lift}
                  className="hit group pointer-events-auto inline-flex h-11 items-center gap-2 rounded-full border border-white/30 bg-white/5 px-5 text-sm font-medium tracking-wide text-white backdrop-blur-sm transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  {texts.lift}
                  <ChevronDown className="size-4 transition-transform group-hover:translate-y-0.5" aria-hidden />
                </button>
              </div>
            )}

            {/* Le plat annoncé, une fois la cloche levée */}
            <div ref={revealBox} className="absolute inset-x-5 bottom-[6%] sm:inset-x-8 lg:bottom-auto lg:right-auto lg:top-1/2 lg:w-[26rem] xl:w-[30rem] lg:-translate-y-1/2">
              <div
                className="invisible text-center [text-shadow:0_1px_18px_rgba(0,0,0,0.8)] lg:text-left [[data-revealed=true]_&]:visible"
                style={{ opacity: "calc((var(--p) - 0.55) * 3)", transform: "translateY(calc((1 - var(--p)) * 30px))" } as React.CSSProperties}
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-brand-300">{texts.revealKicker}</p>
                {texts.dish ? (
                  <>
                    <p className="mt-3 font-display text-4xl font-bold tracking-tight leading-tight text-balance sm:text-5xl xl:text-6xl">{texts.dish}</p>
                    {texts.sides.length > 0 && <p className="mt-4 text-sm text-white/80">{texts.sides.join("  ·  ")}</p>}
                    {texts.allergens && <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-red-300">{texts.allergens}</p>}
                  </>
                ) : (
                  <p className="mt-3 font-display text-3xl font-bold tracking-tight text-balance sm:text-4xl">{texts.empty}</p>
                )}
                <Link
                  href={texts.cta.href}
                  className="hit pointer-events-auto mt-7 inline-flex h-12 items-center justify-center rounded-full bg-white px-7 text-sm font-semibold tracking-wide text-brand-950 transition-[background-color,transform] duration-150 [text-shadow:none] hover:bg-brand-50 active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  {texts.cta.label}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
