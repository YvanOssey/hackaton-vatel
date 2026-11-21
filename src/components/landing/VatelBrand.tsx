import { LogoMark, Wordmark } from "@/components/brand";
import { cn } from "@/lib/utils";

/**
 * Logo de l'application (LogoMark : logo Vatel avec la toque), comme sur toutes les autres pages.
 * `plate` : fond sombre, liseré clair pour détacher le carré noir.
 */
export function VatelLogo({ className, plate, height = 40 }: { className?: string; plate?: boolean; height?: number }) {
  return (
    <span className={cn("inline-flex", className)} style={{ width: height, height }} translate="no">
      <LogoMark onDark={plate} className="size-full" />
    </span>
  );
}

/** Signature commune : logo Vatel, filet, marque CantineConnect */
export function CoBrand({ light, className, size = "sm" }: { light?: boolean; className?: string; size?: "sm" | "md" }) {
  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      <VatelLogo plate={light} height={size === "md" ? 40 : 32} />
      <span className={cn("h-7 w-px", light ? "bg-white/25" : "bg-slate-300")} aria-hidden />
      <Wordmark light={light} className={size === "md" ? "text-xl" : "text-lg"} />
    </span>
  );
}
