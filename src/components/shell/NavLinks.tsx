"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Banknote,
  CalendarDays,
  ChefHat,
  HeartHandshake,
  Landmark,
  LayoutDashboard,
  Package,
  QrCode,
  ScrollText,
  Settings,
  Store,
  UserRound,
  Users,
  UtensilsCrossed,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";

export const NAV_ICONS = {
  menu: CalendarDays,
  wallet: Wallet,
  pass: QrCode,
  profile: UserRound,
  family: HeartHandshake,
  dashboard: LayoutDashboard,
  users: Users,
  cash: Banknote,
  finance: Landmark,
  settings: Settings,
  journal: ScrollText,
  kitchen: ChefHat,
  dishes: UtensilsCrossed,
  stock: Package,
  stats: BarChart3,
  store: Store,
} satisfies Record<string, LucideIcon>;

export type NavItem = { href: string; label: string; short?: string; icon?: keyof typeof NAV_ICONS; badge?: number };

function useActive(items: NavItem[]) {
  const pathname = usePathname();
  // Lien actif : le préfixe le plus long qui correspond
  return items.filter((i) => pathname === i.href || pathname.startsWith(`${i.href}/`)).sort((a, b) => b.href.length - a.href.length)[0]?.href;
}

/** Bascule entre les espaces (administrateur) */
export function AreaSwitch({ items }: { items: NavItem[] }) {
  const active = useActive(items);
  const { t } = useI18n();
  return (
    <nav className="flex rounded-xl bg-slate-100 p-1" aria-label={t("Espaces")}>
      {items.map((i) => {
        const Icon = i.icon ? NAV_ICONS[i.icon] : null;
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={active === i.href ? "page" : undefined}
            title={t(i.label)}
            className={cn(
              "hit flex min-h-8 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition sm:px-3",
              active === i.href ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-900/5" : "text-slate-500 hover:text-slate-900",
            )}
          >
            {Icon && <Icon className="size-4" />}
            <span className="hidden md:inline">{t(i.label)}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/** Onglets de section (bureau) */
export function SectionTabs({ items }: { items: NavItem[] }) {
  const active = useActive(items);
  const { t } = useI18n();
  return (
    <nav className="-mb-px flex gap-1 overflow-x-auto [scrollbar-width:none]" aria-label={t("Navigation")}>
      {items.map((i) => {
        const Icon = i.icon ? NAV_ICONS[i.icon] : null;
        const on = active === i.href;
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={on ? "page" : undefined}
            className={cn(
              "relative flex shrink-0 items-center gap-2 px-3 py-3 text-sm font-medium transition-colors",
              on ? "text-slate-900" : "text-slate-500 hover:text-slate-900",
            )}
          >
            {Icon && <Icon className={cn("size-4", on ? "text-brand-600" : "text-slate-400")} />}
            {t(i.label)}
            {!!i.badge && <span className="rounded-full bg-amber-500 px-1.5 text-[11px] font-semibold leading-[18px] text-white">{i.badge}</span>}
            <span className={cn("absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand-600 transition-transform duration-300", on ? "scale-x-100" : "scale-x-0")} />
          </Link>
        );
      })}
    </nav>
  );
}

/** Barre d'onglets du bas (mobile) pour les étudiants et les parents */
export function BottomTabs({ items }: { items: NavItem[] }) {
  const active = useActive(items);
  const { t } = useI18n();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/80 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg md:hidden"
      aria-label={t("Navigation principale")}
    >
      <div className="mx-auto grid max-w-md" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map((i) => {
          const Icon = i.icon ? NAV_ICONS[i.icon] : CalendarDays;
          const on = active === i.href;
          return (
            <Link key={i.href} href={i.href} aria-current={on ? "page" : undefined} className="group flex flex-col items-center gap-1 pb-2 pt-2.5">
              <span className={cn("flex h-7 w-12 items-center justify-center rounded-full transition-colors duration-200", on ? "bg-brand-100 text-brand-700" : "text-slate-400 group-active:bg-slate-100")}>
                <Icon className="size-[19px]" strokeWidth={on ? 2.4 : 2} />
              </span>
              <span className={cn("text-[11px] font-medium", on ? "text-slate-900" : "text-slate-500")}>{t(i.short ?? i.label)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
