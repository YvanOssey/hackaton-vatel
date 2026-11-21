"use client";

import { useState, useTransition } from "react";
import { approveAction, rejectAction } from "@/app/admin/actions";
import { useResultToast } from "@/components/toast";
import { AllergenChip, Avatar, Button, Card, inputCls } from "@/components/ui";
import { useI18n } from "@/i18n/client";

type U = { id: string; firstName: string; lastName: string; email: string; phone: string | null; memberRef: string | null; allergens: string[]; balance: number; createdAt: string };

export function PendingReview({ user }: { user: U }) {
  const { t, money, dateTime } = useI18n();
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const show = useResultToast();
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start gap-4">
        <Avatar user={user} />
        <div className="min-w-[200px] flex-1">
          <p className="font-semibold text-slate-900">
            {user.firstName} {user.lastName}
          </p>
          <p className="text-sm text-slate-500">
            {user.email}
            {user.phone && ` · ${user.phone}`}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            {t("N° étudiant :")} <strong className="font-mono">{user.memberRef ?? "—"}</strong>
            {user.balance > 0 && <> · {t("Solde {amount:money}", { amount: user.balance })}</>}
          </p>
          {user.allergens.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {user.allergens.map((a) => (
                <AllergenChip key={a} id={a} highlight />
              ))}
            </div>
          )}
          <p className="mt-2 text-xs text-slate-500">{t("Inscrit le {date}", { date: dateTime(user.createdAt) })}</p>
        </div>
      </div>
      {rejecting ? (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("Motif du refus (visible par l'usager)…")} maxLength={300} className={inputCls} autoFocus />
          <Button variant="secondary" onClick={() => setRejecting(false)}>
            {t("Retour")}
          </Button>
          <Button variant="danger" disabled={pending || note.trim().length < 3} onClick={() => start(async () => void show(await rejectAction(user.id, note), "Inscription refusée"))}>
            {t("Refuser")}
          </Button>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
          <span className="text-sm text-slate-600">{t("Vérifiez le numéro étudiant avant de valider.")}</span>
          <span className="flex-1" />
          <Button variant="ghost" onClick={() => setRejecting(true)}>
            {t("Refuser")}
          </Button>
          <Button disabled={pending} onClick={() => start(async () => void show(await approveAction(user.id), "Inscription validée"))}>
            {t("Valider")}
          </Button>
        </div>
      )}
    </Card>
  );
}
