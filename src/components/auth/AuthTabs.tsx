"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/connexion", label: "Connexion" },
  { href: "/inscription", label: "Inscription" },
];

/** Bascule connexion / inscription : l'indicateur glisse d'un onglet à l'autre */
export function AuthTabs() {
  const pathname = usePathname();
  const { t: tr } = useI18n();
  const index = Math.max(0, TABS.findIndex((t) => pathname.startsWith(t.href)));
  return (
    <nav className="relative grid grid-cols-2 rounded-xl bg-slate-100 p-1" aria-label={tr("Accès au compte")}>
      <span
        className="absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-lg bg-white shadow-sm ring-1 ring-slate-900/5 transition-transform duration-300 ease-[var(--ease-out-expo)]"
        style={{ transform: `translateX(${index * 100}%)` }}
        aria-hidden
      />
      {TABS.map((t, i) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={i === index ? "page" : undefined}
          className={cn("hit z-10 rounded-lg py-2 text-center text-sm font-semibold transition-colors", i === index ? "text-slate-900" : "text-slate-500 hover:text-slate-800")}
        >
          {tr(t.label)}
        </Link>
      ))}
    </nav>
  );
}
