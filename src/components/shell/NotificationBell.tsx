"use client";

import {
  useEffect,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from "react";
import Link from "next/link";
import {
  Bell,
  BellRing,
  CheckCheck,
  HeartHandshake,
  TriangleAlert,
  UserCheck,
  Utensils,
  Wallet,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { markReadAction } from "@/app/actions/notifications";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";

export type InboxItem = {
  id: string;
  kind: string;
  title: string;
  body: string;
  href: string | null;
  read: boolean;
  createdAt: string;
};

const KIND: Record<string, { icon: LucideIcon; tone: string }> = {
  account: { icon: UserCheck, tone: "bg-emerald-100 text-emerald-700" },
  low_balance: { icon: TriangleAlert, tone: "bg-amber-100 text-amber-700" },
  meal_served: { icon: Utensils, tone: "bg-sky-100 text-sky-700" },
  topup: { icon: Wallet, tone: "bg-emerald-100 text-emerald-700" },
  family: { icon: HeartHandshake, tone: "bg-violet-100 text-violet-700" },
  payment_failed: { icon: XCircle, tone: "bg-red-100 text-red-700" },
  test: { icon: BellRing, tone: "bg-emerald-100 text-emerald-700" },
};

function ago(iso: string, locale: string, now: string) {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const s = (new Date(iso).getTime() - Date.now()) / 1000;
  if (s > -60) return now;
  if (s > -3600) return rtf.format(Math.round(s / 60), "minute");
  if (s > -86400) return rtf.format(Math.round(s / 3600), "hour");
  return rtf.format(Math.round(s / 86400), "day");
}

export function NotificationBell({
  items,
  unread,
}: {
  items: InboxItem[];
  unread: number;
}) {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const [, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  const [state, setOptimistic] = useOptimistic(
    { items, unread },
    (s, ids: string[] | "all") => ({
      unread:
        ids === "all"
          ? 0
          : Math.max(
              0,
              s.unread -
                s.items.filter((i) => ids.includes(i.id) && !i.read).length,
            ),
      items: s.items.map((i) =>
        ids === "all" || ids.includes(i.id) ? { ...i, read: true } : i,
      ),
    }),
  );

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) =>
      ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const readAll = () =>
    start(async () => {
      setOptimistic("all");
      await markReadAction();
    });
  /** Ouvrir une notification la marque comme lue ; la navigation est un vrai lien (Ctrl+clic, clic molette) */
  const openItem = (n: InboxItem) => {
    setOpen(false);
    if (!n.read)
      start(async () => {
        setOptimistic([n.id]);
        await markReadAction([n.id]);
      });
  };

  const Icon = state.unread ? BellRing : Bell;
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "hit flex size-10 items-center justify-center rounded-xl transition hover:bg-slate-100",
          open ? "bg-slate-100 text-slate-900" : "text-slate-500",
        )}
        aria-label={
          state.unread
            ? t("Notifications, {count} non lues", { count: state.unread })
            : t("Notifications")
        }
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Icon className={cn("size-5", state.unread > 0 && "text-slate-800")} />
        {state.unread > 0 && (
          <span className="absolute right-1.5 top-1.5 flex min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-4 text-white ring-2 ring-white">
            {state.unread > 9 ? "9+" : state.unread}
          </span>
        )}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={t("Notifications")}
          className="fixed inset-x-3 top-[4.25rem] z-50 origin-top-right overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_-20px_rgba(15,23,42,0.35)] ring-1 ring-slate-900/10 [animation:pop_180ms_ease-out] sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-96"
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="font-display font-semibold text-slate-900">
              {t("Notifications")}
            </p>
            {state.unread > 0 && (
              <button
                onClick={readAll}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
              >
                <CheckCheck className="size-3.5" /> {t("Tout marquer comme lu")}
              </button>
            )}
          </div>
          {state.items.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-10 text-center">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                <Bell className="size-5" />
              </span>
              <p className="mt-3 text-sm font-medium text-slate-800">
                {t("Rien de neuf")}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                {t(
                  "Rechargements, repas et alertes de solde s'afficheront ici.",
                )}
              </p>
            </div>
          ) : (
            <ul className="max-h-[min(70vh,26rem)] divide-y divide-slate-100 overflow-y-auto">
              {state.items.map((n) => {
                const k = KIND[n.kind] ?? KIND.account;
                const cls = cn(
                  "flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none",
                  !n.read && "bg-emerald-50/40",
                );
                const content = (
                  <>
                    <span
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-xl",
                        k.tone,
                      )}
                    >
                      <k.icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-2">
                        <span
                          className={cn(
                            "text-sm",
                            n.read
                              ? "font-medium text-slate-700"
                              : "font-semibold text-slate-900",
                          )}
                        >
                          {n.title}
                        </span>
                        {!n.read && (
                          <span
                            className="mt-1.5 size-2 shrink-0 rounded-full bg-emerald-500"
                            aria-label={t("non lue")}
                          />
                        )}
                      </span>
                      <span className="mt-0.5 block text-[13px] leading-snug text-slate-500">
                        {n.body}
                      </span>
                      <span className="mt-1 block text-[11px] text-slate-500">
                        {ago(n.createdAt, locale, t("à l'instant"))}
                      </span>
                    </span>
                  </>
                );
                return (
                  <li key={n.id}>
                    {n.href ? (
                      <Link
                        href={n.href}
                        onClick={() => openItem(n)}
                        className={cls}
                      >
                        {content}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openItem(n)}
                        className={cls}
                      >
                        {content}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
