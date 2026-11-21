"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";

export type ToastTone = "success" | "error" | "info" | "warning";
interface Toast {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string;
}

const ToastContext = createContext<((t: Omit<Toast, "id">) => void) | null>(null);
let seq = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { t: tr } = useI18n();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = useCallback((id: number) => setToasts((ts) => ts.filter((t) => t.id !== id)), []);
  const push = useCallback(
    (t: Omit<Toast, "id">) => {
      const id = ++seq;
      setToasts((ts) => [...ts.slice(-2), { ...t, id }]);
      setTimeout(() => dismiss(id), t.tone === "error" ? 6000 : 3500);
    },
    [dismiss],
  );
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:items-end" aria-live="polite">
        {toasts.map((t) => {
          const Icon = { success: CircleCheck, error: CircleAlert, warning: TriangleAlert, info: Info }[t.tone];
          return (
            <div key={t.id} role={t.tone === "error" ? "alert" : "status"} className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-lg animate-[slide-up_200ms_ease-out]">
              <Icon className={cn("mt-0.5 size-5 shrink-0", { success: "text-emerald-600", error: "text-red-600", warning: "text-amber-600", info: "text-brand-600" }[t.tone])} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900">{t.title}</p>
                {t.description && <p className="mt-0.5 text-sm text-slate-600">{t.description}</p>}
              </div>
              <button onClick={() => dismiss(t.id)} className="rounded-md p-0.5 text-slate-500 hover:text-slate-700" aria-label={tr("Fermer")}>
                <X className="size-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast doit être utilisé dans <ToastProvider>");
  return ctx;
}

/** Affiche le résultat d'une action serveur ; renvoie true en cas de succès */
export function useResultToast() {
  const toast = useToast();
  const { t } = useI18n();
  return useCallback(
    /** successTitle : texte source, traduit ici */
    (res: { ok: boolean; message?: string }, successTitle: string) => {
      if (res.ok) toast({ tone: "success", title: t(successTitle), description: res.message });
      else toast({ tone: "error", title: t("Action refusée"), description: res.message });
      return res.ok;
    },
    [toast, t],
  );
}
