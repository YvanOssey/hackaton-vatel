"use client";

import { useState, useTransition } from "react";
import { unlinkChildAction } from "@/app/famille/actions";
import { useResultToast } from "@/components/toast";
import { useI18n } from "@/i18n/client";

export function UnlinkChild({ childId, name }: { childId: string; name: string }) {
  const { t } = useI18n();
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  const show = useResultToast();
  if (!confirm) {
    return (
      <button onClick={() => setConfirm(true)} className="hit text-xs font-medium text-slate-500 hover:text-red-600">
        {t("Ne plus suivre {name}", { name })}
      </button>
    );
  }
  return (
    <span className="flex items-center gap-2 text-xs">
      <span className="text-slate-600">{t("Confirmer ?")}</span>
      <button onClick={() => setConfirm(false)} className="font-semibold text-slate-600 hover:underline">
        {t("Non")}
      </button>
      <button disabled={pending} onClick={() => start(async () => void show(await unlinkChildAction(childId), "Association supprimée"))} className="font-semibold text-red-600 hover:underline">
        {t("Oui, retirer")}
      </button>
    </span>
  );
}
