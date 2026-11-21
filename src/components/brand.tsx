import { cn } from "@/lib/utils";

/** Contour du ticket de cantine (48×48) : coins arrondis et deux encoches latérales */
export const TICKET_PATH =
  "M14 4h20a10 10 0 0 1 10 10v5.5a4.5 4.5 0 0 0 0 9V34a10 10 0 0 1-10 10H14A10 10 0 0 1 4 34v-5.5a4.5 4.5 0 0 0 0-9V14A10 10 0 0 1 14 4Z";

/** Logo : un ticket de cantine portant une fourchette et un couteau */
export function LogoMark({ className, animated, tone = "brand" }: { className?: string; animated?: boolean; tone?: "brand" | "light" }) {
  const stroke = (len: number, delay: number) =>
    animated
      ? ({ strokeDasharray: len, strokeDashoffset: len, animation: `draw 800ms var(--ease-out-expo) ${delay}ms forwards`, "--len": len } as React.CSSProperties)
      : undefined;
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden>
      <path d={TICKET_PATH} className={tone === "light" ? "fill-white" : "fill-brand-300"} />
      <path d={TICKET_PATH} className={tone === "light" ? "fill-transparent" : "fill-[url(#lm-shine)]"} />
      <defs>
        <linearGradient id="lm-shine" x1="4" y1="4" x2="44" y2="44">
          <stop stopColor="#ffffff" stopOpacity="0.45" />
          <stop offset="0.6" stopColor="#86c3ea" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g stroke="#1d1d1b" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 13v8.5a3 3 0 0 0 6 0V13M20 13v22" style={stroke(48, 250)} />
        <path d="M31.5 35V13c-3.2 2.2-4.6 5.6-4.6 10.2h4.6" style={stroke(48, 480)} />
      </g>
    </svg>
  );
}

export function Wordmark({ className, light }: { className?: string; light?: boolean }) {
  return (
    <span translate="no" className={cn("font-display font-bold tracking-tight", light ? "text-white" : "text-slate-900", className)}>
      Cantine<span className={light ? "text-brand-300" : "text-brand-600"}>Connect</span>
    </span>
  );
}

export function Brand({ className, light, size = "md" }: { className?: string; light?: boolean; size?: "sm" | "md" | "lg" }) {
  const s = { sm: ["size-8", "text-base"], md: ["size-9", "text-lg"], lg: ["size-11", "text-2xl"] }[size];
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark className={cn(s[0], "shrink-0 drop-shadow-sm")} />
      <Wordmark light={light} className={s[1]} />
    </span>
  );
}
