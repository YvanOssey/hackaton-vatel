"use client";

import { useState, useTransition } from "react";
import { Check, Copy, HeartHandshake, KeyRound, ShieldCheck, UserMinus } from "lucide-react";
import { createLinkCodeAction, revokeLinkCodeAction, unlinkParentAction } from "@/app/espace/actions";
import { useResultToast, useToast } from "@/components/toast";
import { Avatar, Button, EmptyState } from "@/components/ui";
import { useI18n } from "@/i18n/client";

type Parent = { id: string; firstName: string; lastName: string; email: string; since: string };

/** Côté étudiant : code d'association à transmettre au parent, et parents qui suivent le compte */
export function FamilyLinks({ parents, activeCodeExpiresAt }: { parents: Parent[]; activeCodeExpiresAt: string | null }) {
  const { t, dateTime } = useI18n();
  const [code, setCode] = useState<{ code: string; expiresAt: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const show = useResultToast();
  const toast = useToast();

  const generate = () =>
    start(async () => {
      const res = await createLinkCodeAction();
      if (res.ok) setCode(res.data);
      else show(res, "");
    });

  return (
    <div className="divide-y divide-slate-100">
      <div className="p-5">
        {code ? (
          <div className="rounded-2xl bg-brand-950 p-5 text-center text-white [animation:pop_260ms_ease-out]">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-300">{t("Code à transmettre")}</p>
            <p translate="no" className="mt-2 select-all font-mono text-3xl font-bold tracking-[0.2em]">{code.code}</p>
            <p className="mt-2 text-xs text-brand-100/60">{t("Usage unique · expire le {date}", { date: dateTime(code.expiresAt) })}</p>
            <div className="mt-4 flex justify-center gap-2">
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(code.code);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1800);
                  } catch {
                    toast({ tone: "info", title: t("Copie impossible"), description: t("Sélectionnez le code pour le copier.") });
                  }
                }}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-white px-3 text-sm font-semibold text-brand-950 hover:bg-brand-50"
              >
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? t("Copié") : t("Copier")}
              </button>
              <button
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    if (show(await revokeLinkCodeAction(), "Code annulé")) setCode(null);
                  })
                }
                className="inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium text-brand-100/80 ring-1 ring-white/20 hover:bg-white/10"
              >
                {t("Annuler le code")}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600 ring-1 ring-violet-600/10">
              <KeyRound className="size-5" />
            </span>
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-semibold text-slate-900">{t("Associer un parent")}</p>
              <p className="text-slate-500">
                {t("Générez un code et transmettez-le : votre parent pourra suivre vos repas et recharger votre portefeuille.")}
                {activeCodeExpiresAt && ` ${t("Un code est actif jusqu'au {date}.", { date: dateTime(activeCodeExpiresAt) })}`}
              </p>
            </div>
            <Button variant="dark" disabled={pending} onClick={generate} className="shrink-0">
              {activeCodeExpiresAt ? t("Nouveau code") : t("Générer un code")}
            </Button>
          </div>
        )}
      </div>
      {parents.length === 0 ? (
        <EmptyState icon={<HeartHandshake className="size-6" />} title={t("Aucun parent associé")}>
          {t("Seuls les parents que vous associez voient votre solde et vos repas.")}
        </EmptyState>
      ) : (
        <ul className="divide-y divide-slate-100">
          {parents.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-5 py-3.5">
              <Avatar user={p} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {p.firstName} {p.lastName}
                </p>
                <p className="truncate text-xs text-slate-500">{p.email}</p>
              </div>
              {confirm === p.id ? (
                <div className="flex gap-1.5">
                  <Button size="sm" variant="secondary" onClick={() => setConfirm(null)}>
                    {t("Garder")}
                  </Button>
                  <Button size="sm" variant="danger" disabled={pending} onClick={() => start(async () => void show(await unlinkParentAction(p.id), "Association retirée"))}>
                    {t("Retirer")}
                  </Button>
                </div>
              ) : (
                <button onClick={() => setConfirm(p.id)} className="flex size-11 items-center justify-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600" aria-label={t("Retirer {name}", { name: p.firstName })}>
                  <UserMinus className="size-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="flex items-center gap-2 px-5 py-3 text-xs text-slate-500">
        <ShieldCheck className="size-3.5 text-brand-600" /> {t("Vous pouvez retirer un parent à tout moment.")}
      </p>
    </div>
  );
}
