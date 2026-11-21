import { cn } from "@/lib/utils";

/** Contour du ticket de cantine (48×48) : coins arrondis et deux encoches latérales */
export const TICKET_PATH =
  "M14 4h20a10 10 0 0 1 10 10v5.5a4.5 4.5 0 0 0 0 9V34a10 10 0 0 1-10 10H14A10 10 0 0 1 4 34v-5.5a4.5 4.5 0 0 0 0-9V14A10 10 0 0 1 14 4Z";

/** Formes de la toque de chef (repère local : base du bandeau centrée en 24, 13.2) */
function HatShapes() {
  return (
    <>
      <circle cx="21.2" cy="9.6" r="2" />
      <circle cx="24" cy="8.4" r="2.6" />
      <circle cx="26.8" cy="9.6" r="2" />
      <rect x="19.6" y="9.4" width="8.8" height="1.8" />
      <rect x="20.4" y="10.8" width="7.2" height="2.4" rx="0.4" />
    </>
  );
}

/**
 * Logo : le logo Vatel (carré noir #1d1d1b, V à empattements, bandeau bleu #86c3ea « VATEL »)
 * avec une toque de chef posée sur le coin supérieur droit, hors du cadre.
 * La toque a un contour noir Vatel pour rester visible sur fond blanc comme sur fond sombre.
 * - `named` : écrit « VATEL » dans le bandeau (à partir d'environ 64 px de large).
 * - `onDark` : liseré clair pour détacher le carré noir d'un fond sombre.
 */
export function LogoMark({ className, animated, named, onDark }: { className?: string; animated?: boolean; named?: boolean; onDark?: boolean }) {
  const appear = (delay: number) => (animated ? { opacity: 0, animation: `fade-in 500ms ease-out ${delay}ms forwards` } : undefined);
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden>
      <rect x="2" y="10" width="36" height="36" rx="0.9" fill="#1d1d1b" />
      <path d="M2 36.1h36v9a.9.9 0 0 1-.9.9H2.9a.9.9 0 0 1-.9-.9z" fill="#86c3ea" />
      {onDark && <rect x="2.45" y="10.45" width="35.1" height="35.1" rx="0.7" stroke="#fff" strokeOpacity="0.4" strokeWidth="0.9" />}
      {/* V à empattements, plein à gauche et délié à droite */}
      <path fill="#fff" d="M8.92 17.38 L15.53 17.38 L15.53 18.07 L14.17 18.07 L20.87 30.48 L27.19 18.07 L25.45 18.07 L25.45 17.38 L30.89 17.38 L30.89 18.07 L28.75 18.07 L20.49 34.84 L19.51 34.84 L10.67 18.07 L8.92 18.07Z" style={appear(150)} />
      {/* Toque de chef posée sur le coin supérieur droit */}
      <g transform="translate(37.2 10.4) rotate(20) translate(-24 -13.2)" style={appear(450)}>
        <g fill="#1d1d1b" stroke="#1d1d1b" strokeWidth="1.3" strokeLinejoin="round">
          <HatShapes />
        </g>
        <g fill="#fff">
          <HatShapes />
        </g>
        <path d="M20.4 10.9h7.2M22.6 10.8V9.3M25.4 10.8V9.3" stroke="#1d1d1b" strokeWidth="0.55" strokeLinecap="round" />
      </g>
      {named && (
        <text x="20" y="43.75" textAnchor="middle" fontFamily="Georgia, 'Times New Roman', serif" fontSize="6.7" letterSpacing="0.9" fill="#fff">
          VATEL
        </text>
      )}
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
      <LogoMark onDark={light} className={cn(s[0], "shrink-0 drop-shadow-sm")} />
      <Wordmark light={light} className={s[1]} />
    </span>
  );
}
