"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Banknote, ClipboardList, Clock, Lock, ScanLine, Search, Utensils } from "lucide-react";
import type { CustomerSnapshot } from "@/server/services/pos";
import { customerAction, scanAction, searchAction } from "@/app/caisse/actions";
import { useToast } from "@/components/toast";
import { Avatar, Button, Card, CardHeader, EmptyState } from "@/components/ui";
import { COURSES, METHODS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { CustomerPanel } from "./CustomerPanel";
import { CloseSessionModal } from "./CloseSessionModal";
import { useI18n } from "@/i18n/client";

type JournalEntry = { id: string; type: string; method: string; amount: number; label: string; createdAt: string; user: { id: string; firstName: string; lastName: string } };
export type PosState = {
  today: string;
  session: { id: string; openedAt: string; openingFloat: number };
  menu: { dishes: { id: string; course: string; name: string }[] } | null;
  reservedCount: number;
  servedCount: number;
  totals: { mealCount: number; mealTotal: number; cashTopupCount: number; cashIn: number; expectedCash: number };
  journal: JournalEntry[];
};

type Suggestion = { id: string; firstName: string; lastName: string; memberRef: string | null; status: string };

export function PosScreen({ state, timezone }: { state: PosState; timezone: string }) {
  const { t, day } = useI18n();
  const [customer, setCustomer] = useState<CustomerSnapshot | null>(null);
  const [closing, setClosing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const focusScan = () => setTimeout(() => inputRef.current?.focus(), 0);
  const pct = state.reservedCount ? Math.round((state.servedCount / state.reservedCount) * 100) : 0;

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl bg-brand-950 px-5 py-4 text-white">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{t("Service")}</p>
          <h1 className="font-semibold">
            <span className="sr-only">{t("Caisse")} · </span>
            {day(state.today)}
          </h1>
        </div>
        <LiveClock timezone={timezone} />
        <div className="min-w-[180px] flex-1">
          <div className="flex justify-between text-sm">
            <span className="text-slate-300">{t("Passages")}</span>
            <span className="font-semibold tabular-nums">
              {t("{served} / {reserved} réservés", { served: state.servedCount, reserved: state.reservedCount })}
            </span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-full origin-left rounded-full bg-brand-400 transition-transform duration-500" style={{ transform: `scaleX(${pct / 100})` }} />
          </div>
        </div>
        <Button variant="secondary" size="sm" className="ring-0" onClick={() => setClosing(true)}>
          <Lock className="size-4" /> {t("Clôturer la caisse")}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-5">
          <ScanBar ref={inputRef} onCustomer={(c) => setCustomer(c)} />
          {customer ? (
            <CustomerPanel
              customer={customer}
              onUpdate={(c) => {
                setCustomer(c);
                focusScan();
              }}
              onClear={() => {
                setCustomer(null);
                focusScan();
              }}
            />
          ) : (
            <Card>
              <EmptyState icon={<ScanLine className="size-6" />} title={t("En attente d'un passage")}>
                {t("Scannez le QR Code de l'usager avec la douchette, ou recherchez-le par nom ou numéro étudiant.")}
              </EmptyState>
            </Card>
          )}
          {state.menu ? (
            <Card className="grid grid-cols-1 gap-4 p-5 text-sm sm:grid-cols-3">
              {state.menu.dishes.map((d) => (
                <div key={d.id}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t(COURSES[d.course as keyof typeof COURSES] ?? d.course)}</p>
                  <p className="mt-0.5 font-medium text-slate-800">{d.name}</p>
                </div>
              ))}
            </Card>
          ) : (
            <Card className="p-5 text-sm text-amber-800">{t("Aucun menu publié aujourd'hui : seuls les rechargements sont possibles.")}</Card>
          )}
        </div>
        <Journal state={state} timezone={timezone} />
      </div>
      <CloseSessionModal open={closing} onClose={() => setClosing(false)} state={state} />
    </>
  );
}

function LiveClock({ timezone }: { timezone: string }) {
  const { time } = useI18n();
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="flex items-center gap-2 text-2xl font-semibold tabular-nums">
      <Clock className="size-5 text-slate-400" />
      {now ? time(now, timezone) : "--:--"}
    </div>
  );
}

const looksLikePass = (v: string) => /^(CANTINE:)?CC1\./i.test(v.trim());

function ScanBar({ onCustomer, ref }: { onCustomer: (c: CustomerSnapshot) => void; ref: React.Ref<HTMLInputElement> }) {
  const toast = useToast();
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [active, setActive] = useState(0);
  const [pending, start] = useTransition();

  // Recherche par nom (désactivée pendant un scan de douchette)
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2 || looksLikePass(q)) {
      setSuggestions([]);
      return;
    }
    const id = setTimeout(async () => {
      const res = await searchAction(q);
      if (res.ok) {
        setSuggestions(res.data);
        setActive(0);
      }
    }, 200);
    return () => clearTimeout(id);
  }, [query]);

  const open = (fn: () => Promise<{ ok: true; data: CustomerSnapshot } | { ok: false; message: string }>) =>
    start(async () => {
      const res = await fn();
      if (res.ok) {
        onCustomer(res.data);
        setQuery("");
        setSuggestions([]);
      } else {
        toast({ tone: "error", title: t("Pass refusé"), description: res.message });
        setQuery("");
      }
    });

  const submit = () => {
    const q = query.trim();
    if (!q) return;
    if (looksLikePass(q)) return open(() => scanAction(q));
    const pick = suggestions[active];
    if (pick) return open(() => customerAction(pick.id));
  };

  return (
    <div className="relative">
      <ScanLine className="pointer-events-none absolute left-4 top-1/2 size-6 -translate-y-1/2 text-brand-600" />
      <input
        ref={ref}
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          } else if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, suggestions.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Escape") setQuery("");
        }}
        placeholder={t("Scanner un pass ou rechercher (nom, n° étudiant)…")}
        aria-label={t("Scanner un pass ou rechercher un usager")}
        autoComplete="off"
        spellCheck={false}
        className="h-16 w-full rounded-2xl border-0 bg-white pl-14 pr-28 text-lg shadow-sm ring-1 ring-inset ring-slate-200 placeholder:text-slate-400 focus:ring-2 focus:ring-brand-500 focus:outline-none"
      />
      <Button className="absolute right-2.5 top-1/2 -translate-y-1/2" onClick={submit} disabled={pending}>
        <Search className="size-4" /> OK
      </Button>
      {suggestions.length > 0 && (
        <ul className="absolute inset-x-0 top-full z-20 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg" role="listbox">
          {suggestions.map((u, i) => (
            <li key={u.id} role="option" aria-selected={i === active}>
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => open(() => customerAction(u.id))}
                className={cn("flex w-full items-center gap-3 px-4 py-3 text-left", i === active ? "bg-brand-50" : "hover:bg-slate-50")}
              >
                <Avatar user={u} size="sm" />
                <span className="flex-1">
                  <span className="block font-medium text-slate-800">
                    {u.firstName} {u.lastName}
                  </span>
                  {u.memberRef && <span className="block font-mono text-xs text-slate-500">{u.memberRef}</span>}
                </span>
                {u.status === "PENDING" && <span className="text-xs font-medium text-amber-700">{t("En attente")}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Journal({ state, timezone }: { state: PosState; timezone: string }) {
  const { t, money, time } = useI18n();
  return (
    <Card className="flex h-full flex-col self-start">
      <CardHeader title={t("Journal de ma caisse")} subtitle={t("Ouverte à {time} · fond {float:money}", { time: time(state.session.openedAt, timezone), float: state.session.openingFloat })} icon={<ClipboardList className="size-4" />} />
      <div className="grid grid-cols-2 gap-3 border-b border-slate-100 p-4">
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
            <Utensils className="size-3.5" /> {t("Repas servis")}
          </p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">{state.totals.mealCount}</p>
          <p className="text-xs text-slate-500 tabular-nums">{money(state.totals.mealTotal)}</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
            <Banknote className="size-3.5" /> {t("Espèces attendues")}
          </p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">{money(state.totals.expectedCash)}</p>
          <p className="text-xs text-slate-500 tabular-nums">{t("dont {amount:money} encaissés", { amount: state.totals.cashIn })}</p>
        </div>
      </div>
      {state.journal.length === 0 ? (
        <EmptyState icon={<ClipboardList className="size-6" />} title={t("Aucune opération")}>
          {t("Les repas et rechargements de votre session apparaîtront ici.")}
        </EmptyState>
      ) : (
        <ul className="max-h-[560px] divide-y divide-slate-100 overflow-y-auto">
          {state.journal.map((tx, i) => (
            <li key={tx.id} className={cn("flex items-center gap-3 px-4 py-3", i === 0 && "animate-[fade-in_400ms_ease-out]")}>
              <span className="w-11 shrink-0 text-xs font-medium tabular-nums text-slate-500">{time(tx.createdAt, timezone)}</span>
              <Avatar user={tx.user} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-800">
                  {tx.user.firstName} {tx.user.lastName}
                </p>
                <p className="truncate text-xs text-slate-500">{tx.type === "MEAL" ? t(tx.label) : `${t("Rechargement")} · ${t(METHODS[tx.method as keyof typeof METHODS])}`}</p>
              </div>
              <span className={cn("text-sm font-semibold tabular-nums", tx.amount > 0 ? "text-brand-600" : "text-slate-900")}>
                {tx.amount > 0 ? "+" : ""}
                {money(tx.amount)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
