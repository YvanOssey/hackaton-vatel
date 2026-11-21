"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, KeyRound, LogOut } from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import { LangSwitch } from "@/components/LangSwitch";
import { PushMenuRow } from "@/components/push/PushControls";
import { Avatar } from "@/components/ui";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";

export function UserMenu({ user, roleLabel, pushKey }: { user: { id: string; firstName: string; lastName: string; email: string }; roleLabel: string; pushKey: string | null }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn("hit flex items-center gap-2 rounded-xl py-1 pl-1 pr-1.5 transition hover:bg-slate-100 sm:pr-2.5", open && "bg-slate-100")}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t("Mon compte")}
      >
        <Avatar user={user} size="sm" />
        <span className="hidden text-left leading-tight sm:block">
          <span className="block text-sm font-semibold text-slate-900">{user.firstName}</span>
          <span className="block text-[11px] text-slate-500">{t(roleLabel)}</span>
        </span>
        <ChevronDown className={cn("hidden size-4 text-slate-400 transition-transform sm:block", open && "rotate-180")} />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-12 z-50 w-64 origin-top-right overflow-hidden rounded-2xl bg-white p-1.5 shadow-[0_24px_60px_-20px_rgba(15,23,42,0.35)] ring-1 ring-slate-900/10 [animation:pop_160ms_ease-out]">
          <div className="px-3 py-2.5">
            <p className="truncate text-sm font-semibold text-slate-900">
              {user.firstName} {user.lastName}
            </p>
            <p className="truncate text-xs text-slate-500">{user.email}</p>
          </div>
          <div className="flex items-center justify-between px-3 pb-2">
            <span className="text-xs font-medium text-slate-500">{t("Langue")}</span>
            <LangSwitch />
          </div>
          <PushMenuRow publicKey={pushKey} />
          <div className="my-1 h-px bg-slate-100" />
          <Link href="/mot-de-passe" role="menuitem" onClick={() => setOpen(false)} className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            <KeyRound className="size-4 text-slate-400" /> {t("Changer de mot de passe")}
          </Link>
          <form action={logoutAction}>
            <button type="submit" role="menuitem" className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50">
              <LogOut className="size-4" /> {t("Se déconnecter")}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
