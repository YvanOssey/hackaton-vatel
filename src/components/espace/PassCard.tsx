"use client";

import { useState, useTransition } from "react";
import { QRCodeSVG } from "qrcode.react";
import { RefreshCw, Sun } from "lucide-react";
import { regeneratePassAction } from "@/app/espace/actions";
import { LogoMark } from "@/components/brand";
import { useResultToast } from "@/components/toast";
import { Avatar, Button } from "@/components/ui";
import { useI18n } from "@/i18n/client";

export function PassCard({ token, user, memberRef }: { token: string; user: { id: string; firstName: string; lastName: string }; memberRef: string | null }) {
  const { t } = useI18n();
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  const show = useResultToast();
  return (
    <div className="anim-rise mx-auto w-full max-w-sm drop-shadow-[0_24px_40px_rgba(2,44,34,0.18)]">
      <div className="ticket rounded-3xl bg-white [--cut:calc(100%-5.5rem)]">
        <div className="bg-grid relative overflow-hidden rounded-t-3xl bg-emerald-950 px-6 pb-6 pt-5 text-white">
          <div className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-emerald-500/25 blur-2xl" />
          <div className="relative flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm font-semibold">
              <LogoMark className="size-7" /> {t("Pass cantine")}
            </span>
            <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-200 ring-1 ring-emerald-300/30">{t("Étudiant")}</span>
          </div>
          <div className="relative mt-5 flex items-center gap-3">
            <Avatar user={user} size="lg" />
            <div className="min-w-0">
              <p className="truncate font-display text-xl font-bold">
                {user.firstName} {user.lastName}
              </p>
              {memberRef && <p translate="no" className="font-mono text-xs text-emerald-100/60">{t("N° {ref}", { ref: memberRef })}</p>}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center px-6 pb-7 pt-6">
          <div className="rounded-2xl bg-white p-3 ring-1 ring-slate-200">
            <QRCodeSVG value={token} size={216} level="M" marginSize={0} />
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
            <Sun className="size-3.5" /> {t("Augmentez la luminosité pour un scan rapide")}
          </p>
        </div>
        <div className="ticket-cut mx-5" />
        <div className="flex h-[5.5rem] items-center justify-center px-6">
          {confirm ? (
            <div className="flex w-full flex-col items-center gap-2 text-center">
              <p className="text-xs text-slate-600">{t("L'ancien QR Code sera immédiatement refusé en caisse.")}</p>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => setConfirm(false)}>
                  {t("Garder")}
                </Button>
                <Button
                  size="sm"
                  variant="dark"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      show(await regeneratePassAction(), "Nouveau QR Code généré");
                      setConfirm(false);
                    })
                  }
                >
                  {t("Générer un nouveau code")}
                </Button>
              </div>
            </div>
          ) : (
            <button onClick={() => setConfirm(true)} className="flex min-h-11 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-800">
              <RefreshCw className="size-4" /> {t("Téléphone perdu ou code partagé ?")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
