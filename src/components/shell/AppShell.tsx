import Link from "next/link";
import type { Role } from "@prisma/client";
import { LogoMark, Wordmark } from "@/components/brand";
import { ROLES } from "@/lib/constants";
import { LangSwitch } from "@/components/LangSwitch";
import { getI18n } from "@/i18n/server";
import { cn } from "@/lib/utils";
import type { Actor } from "@/server/services/common";
import { pushPublicKey } from "@/server/push";
import { inbox } from "@/server/services/notifications";
import { AreaSwitch, BottomTabs, SectionTabs, type NavItem } from "./NavLinks";
import { NotificationBell } from "./NotificationBell";
import { UserMenu } from "./UserMenu";

/** Espaces accessibles par rôle (l'administrateur peut aussi tenir la caisse et la cuisine) */
const AREAS: Partial<Record<Role, NavItem[]>> = {
  ADMIN: [
    { href: "/admin", label: "Administration", icon: "dashboard" },
    { href: "/caisse", label: "Caisse", icon: "store" },
    { href: "/cuisine", label: "Cuisine", icon: "kitchen" },
  ],
};

/** Rôles « grand public » : navigation par barre d'onglets en bas de l'écran sur mobile */
const MOBILE_FIRST: Role[] = ["CONSUMER", "PARENT"];

export async function AppShell({ user, nav, children, wide }: { user: Actor & { email: string }; nav: NavItem[]; children: React.ReactNode; wide?: boolean }) {
  const areas = AREAS[user.role] ?? [];
  const [box, { t }] = await Promise.all([inbox(user), getI18n()]);
  const items = box.items.map(({ params, ...n }) => ({ ...n, title: t(n.title, params), body: t(n.body, params) }));
  const mobileFirst = MOBILE_FIRST.includes(user.role) && nav.length > 0;
  return (
    <div className={cn("min-h-dvh", mobileFirst && "pb-20 md:pb-0")}>
      <a
        href="#contenu"
        className="fixed left-3 top-3 z-[70] -translate-y-20 rounded-xl bg-brand-950 px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition-transform focus-visible:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
      >
        {t("Aller au contenu")}
      </a>
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/85 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <Link href={ROLES[user.role].home} className="hit flex shrink-0 items-center gap-2.5 rounded-xl focus-visible:outline-2 focus-visible:outline-brand-600" aria-label={t("Accueil")}>
            <LogoMark className="size-9" />
            <Wordmark className="hidden text-[17px] md:block" />
          </Link>
          {areas.length > 0 && <AreaSwitch items={areas} />}
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            {/* Sous 640 px, la langue se choisit dans le menu du compte : l'en-tête garde la place pour l'avatar */}
            <div className="hidden sm:block">
              <LangSwitch />
            </div>
            <NotificationBell items={items} unread={box.unread} />
            <UserMenu user={user} roleLabel={ROLES[user.role].label} pushKey={pushPublicKey()} />
          </div>
        </div>
        {nav.length > 0 && (
          <div className={cn("border-t border-slate-100", mobileFirst && "hidden md:block")}>
            <div className="mx-auto max-w-7xl px-2 sm:px-4">
              <SectionTabs items={nav} />
            </div>
          </div>
        )}
      </header>
      <main id="contenu" tabIndex={-1} className={cn("scroll-mt-28 outline-none", wide ? "mx-auto max-w-7xl px-4 py-5 sm:px-6" : "mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8")}>{children}</main>
      {mobileFirst && <BottomTabs items={nav} />}
    </div>
  );
}
