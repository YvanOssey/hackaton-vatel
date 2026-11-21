"use client";

import { useState, useTransition } from "react";
import type { AccountStatus, Role } from "@prisma/client";
import { adjustBalanceAction, resetPasswordAction, suspendAction } from "@/app/admin/actions";
import { useResultToast, useToast } from "@/components/toast";
import { Button, Card, CardHeader, ConfirmDialog, Field, inputCls } from "@/components/ui";
import { cn } from "@/lib/utils";
import { OneTimePassword } from "./OneTimePassword";
import { useI18n } from "@/i18n/client";

export function AccountActions({ user }: { user: { id: string; role: Role; status: AccountStatus; isSelf: boolean } }) {
  const { t } = useI18n();
  const [pending, start] = useTransition();
  const show = useResultToast();
  const toast = useToast();
  const [password, setPassword] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<null | "reset" | "suspend">(null);
  const [sign, setSign] = useState<1 | -1>(1);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  return (
    <div className="space-y-5">
      {user.role === "CONSUMER" && user.status === "ACTIVE" && (
        <Card>
          <CardHeader title={t("Crédit ou correction")} subtitle={t("Motif obligatoire, tracé dans le journal")} />
          <form
            className="space-y-3 p-5"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                if (show(await adjustBalanceAction(user.id, sign * Number(amount), reason), sign > 0 ? "Portefeuille crédité" : "Portefeuille débité")) {
                  setAmount("");
                  setReason("");
                }
              });
            }}
          >
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
              {([1, -1] as const).map((s) => (
                <button key={s} type="button" onClick={() => setSign(s)} className={cn("rounded-lg py-1.5 text-sm font-medium", sign === s ? "bg-white text-slate-900 shadow-sm" : "text-slate-600")}>
                  {s > 0 ? t("Créditer") : t("Débiter")}
                </button>
              ))}
            </div>
            <Field label={t("Montant (FCFA)")} htmlFor="adj-amount">
              <input id="adj-amount" inputMode="numeric" required value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, "").slice(0, 7))} className={inputCls} />
            </Field>
            <Field label={t("Motif")} htmlFor="adj-reason">
              <input id="adj-reason" required minLength={5} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("Ex. : remboursement repas non servi…")} className={inputCls} />
            </Field>
            <Button type="submit" className="w-full" disabled={pending}>
              {t("Enregistrer")}
            </Button>
          </form>
        </Card>
      )}
      <Card>
        <CardHeader title={t("Sécurité")} />
        <div className="space-y-3 p-5">
          {password ? (
            <OneTimePassword password={password} onDone={() => setPassword(null)} />
          ) : (
            <Button
              variant="secondary"
              className="w-full"
              disabled={pending}
              onClick={() => setConfirm("reset")}
            >
              {t("Réinitialiser le mot de passe")}
            </Button>
          )}
          {!user.isSelf && (user.status === "ACTIVE" || user.status === "SUSPENDED") && (
            <Button variant={user.status === "ACTIVE" ? "danger" : "primary"} className="w-full" disabled={pending} onClick={() => (user.status === "ACTIVE" ? setConfirm("suspend") : start(async () => void show(await suspendAction(user.id, false), "Compte réactivé")))}>
              {user.status === "ACTIVE" ? t("Suspendre le compte") : t("Réactiver le compte")}
            </Button>
          )}
        </div>
      </Card>
      <ConfirmDialog
        open={confirm === "reset"}
        pending={pending}
        onClose={() => setConfirm(null)}
        tone="dark"
        title={t("Réinitialiser le mot de passe ?")}
        confirmLabel={t("Réinitialiser")}
        onConfirm={() =>
          start(async () => {
            const res = await resetPasswordAction(user.id);
            setConfirm(null);
            if (res.ok) setPassword(res.data);
            else toast({ tone: "error", title: t("Action refusée"), description: res.message });
          })
        }
      >
        {t("L'ancien mot de passe cessera de fonctionner et la personne sera déconnectée. Un mot de passe provisoire s'affichera une seule fois.")}
      </ConfirmDialog>
      <ConfirmDialog
        open={confirm === "suspend"}
        pending={pending}
        onClose={() => setConfirm(null)}
        title={t("Suspendre ce compte ?")}
        confirmLabel={t("Suspendre le compte")}
        onConfirm={() =>
          start(async () => {
            if (show(await suspendAction(user.id, true), "Compte suspendu")) setConfirm(null);
          })
        }
      >
        {t("La personne est déconnectée immédiatement et ne peut plus se connecter, réserver ni être servie. Vous pourrez réactiver le compte à tout moment.")}
      </ConfirmDialog>
    </div>
  );
}
