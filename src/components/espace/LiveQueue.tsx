"use client";

import { useEffect, useState } from "react";
import { Clock, Users } from "lucide-react";
import { liveAction } from "@/app/espace/actions";
import type { LiveService } from "@/server/services/live";
import { Card } from "@/components/ui";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/client";

const LEVELS = {
  calm: { label: "Calme", tone: "bg-emerald-50 text-emerald-700 ring-emerald-600/20", bar: "bg-emerald-500" },
  busy: { label: "Affluence modérée", tone: "bg-amber-50 text-amber-800 ring-amber-600/20", bar: "bg-amber-500" },
  rush: { label: "Forte affluence", tone: "bg-red-50 text-red-700 ring-red-600/20", bar: "bg-red-500" },
  closed: { label: "Caisses fermées", tone: "bg-slate-100 text-slate-600 ring-slate-900/10", bar: "bg-slate-400" },
} as const;

/** File d'attente en direct : affluence, attente estimée et meilleur moment pour passer (actualisé chaque minute) */
export function LiveQueue({ initial }: { initial: LiveService }) {
  const { t } = useI18n();
  const [live, setLive] = useState(initial);

  useEffect(() => {
    const refresh = async () => {
      if (document.visibilityState !== "visible") return;
      const res = await liveAction();
      if (res.ok) setLive(res.data);
    };
    const id = window.setInterval(refresh, 60_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  const level = LEVELS[live.inService ? live.level : "closed"];
  const max = Math.max(1, ...live.profile.map((p) => p.usual));

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold tracking-tight text-slate-900">
          <Users className="size-5 text-brand-600" /> {t("File d'attente en direct")}
        </h2>
        <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset", level.tone)}>
          {live.inService && live.openCashiers > 0 && <span className={cn("size-1.5 rounded-full anim-ping-soft", level.bar)} aria-hidden />}
          {t(level.label)}
        </span>
      </div>

      {live.inService && live.openCashiers > 0 ? (
        <p className="mt-3 text-sm text-slate-600" aria-live="polite">
          <strong className="font-display text-2xl font-bold tabular-nums text-slate-900">{t("≈ {count} min", { count: live.waitMinutes ?? 0 })}</strong>{" "}
          {t("d'attente · {count} passages ces 10 dernières minutes · {cashiers} caisse(s) ouverte(s)", { count: live.passagesLast10, cashiers: live.openCashiers })}
        </p>
      ) : (
        <p className="mt-3 text-sm text-slate-600">{t("Service de {start} à {end}.", { start: live.serviceStart, end: live.serviceEnd })}</p>
      )}

      {/* Affluence habituelle par créneau (même jour, 4 dernières semaines) */}
      {live.profile.some((p) => p.usual > 0) && (
        <div className="mt-4">
          <div className="flex h-16 items-end gap-1" role="img" aria-label={t("Affluence habituelle par quart d'heure")}>
            {live.profile.map((p) => (
              <div key={p.slot} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className={cn("w-full rounded-t-sm", p.slot === live.now && live.inService ? "bg-brand-600" : p.slot === live.best ? "bg-brand-300" : "bg-slate-200")}
                  style={{ height: `${Math.max(6, (p.usual / max) * 100)}%` }}
                  title={t("{time} : {count} passages en moyenne", { time: p.slot, count: p.usual })}
                />
              </div>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[11px] tabular-nums text-slate-400">
            <span>{live.serviceStart}</span>
            <span>{live.serviceEnd}</span>
          </div>
          {live.best && (
            <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-brand-700">
              <Clock className="size-4" /> {t("Moins de monde d'habitude vers {time}.", { time: live.best })}
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
