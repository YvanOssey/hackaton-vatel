"use client";

import { useEffect, useState, useTransition } from "react";
import { Banknote, CircleCheck, CircleX, Clock3, ShieldAlert, TriangleAlert, X } from "lucide-react";
import type { CustomerSnapshot } from "@/server/services/pos";
import { cashTopUpAction, serveAction } from "@/app/caisse/actions";
import { useToast } from "@/components/toast";
import { AllergenChip, Avatar, Badge, Button, Card, inputCls } from "@/components/ui";
import { CASH_TOPUP_PRESETS, TOPUP_MAX, TOPUP_MIN, allergenLabel } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { rich } from "@/i18n/rich";
import { useI18n } from "@/i18n/client";

export function CustomerPanel({ customer, onUpdate, onClear }: { customer: CustomerSnapshot; onUpdate: (c: CustomerSnapshot) => void; onClear: () => void }) {
  const toast = useToast();
  const { t, money, num, time } = useI18n();
  const [ack, setAck] = useState(false);
  const [served, setServed] = useState<null | { price: number; balance: number }>(null);
  const [custom, setCustom] = useState("");
  const [pending, start] = useTransition();
  const { user, reservation, price, conflicts } = customer;

  useEffect(() => {
    setAck(false);
    setServed(null);
    setCustom("");
  }, [user.id]);

  const isServed = reservation?.status === "SERVED";
  const active = user.status === "ACTIVE";
  const insufficient = !isServed && user.balance < price;
  const walkInBlocked = !reservation && !customer.allowWalkIn;
  const blockedByAllergen = conflicts.length > 0 && !ack;
  const canServe = active && customer.hasMenu && !isServed && !insufficient && !walkInBlocked && !blockedByAllergen;

  const serve = () =>
    start(async () => {
      const res = await serveAction(user.id, ack);
      if (res.ok) {
        setServed({ price: res.data.price, balance: res.data.balance });
        onUpdate(res.data.snapshot);
        toast({ tone: "success", title: t("Repas validé"), description: res.message });
      } else toast({ tone: "error", title: t("Validation refusée"), description: res.message });
    });

  const topUp = (amount: number) =>
    start(async () => {
      const res = await cashTopUpAction(user.id, amount);
      if (res.ok) {
        onUpdate(res.data);
        setCustom("");
        toast({ tone: "success", title: t("Espèces encaissées"), description: res.message });
      } else toast({ tone: "error", title: t("Rechargement refusé"), description: res.message });
    });

  const customValue = Number(custom);

  return (
    <Card className="overflow-hidden animate-[pop_220ms_ease-out]">
      <div className="flex items-center gap-4 border-b border-slate-100 p-5">
        <Avatar user={user} size="xl" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-2xl font-semibold tracking-tight text-slate-900">
            {user.firstName} {user.lastName}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {user.memberRef && <span translate="no" className="font-mono text-sm text-slate-500">{t("N° {ref}", { ref: user.memberRef })}</span>}
            {!active && <Badge tone="warning">{t("Compte en attente de validation")}</Badge>}
          </div>
        </div>
        <button onClick={onClear} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700" aria-label={t("Usager suivant")}>
          <X className="size-6" />
        </button>
      </div>

      <div className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-100">
        <Tile label={t("Solde")}>
          <span className={cn("tabular-nums", insufficient ? "text-red-600" : user.balance < customer.lowBalanceThreshold ? "text-amber-600" : "text-slate-900")}>
            {money(user.balance)}
          </span>
        </Tile>
        <Tile label={t("Réservation du jour")}>
          {isServed ? (
            <Badge tone="success" className="text-sm">
              {t("Servi")} {reservation?.servedAt && time(reservation.servedAt)}
            </Badge>
          ) : reservation ? (
            <Badge tone="brand" className="text-sm">{t("Réservé")}</Badge>
          ) : (
            <Badge tone="warning" className="text-sm">{t("Non réservé")}</Badge>
          )}
        </Tile>
        <Tile label={t("Tarif")}>
          <span className="tabular-nums">{money(price)}</span>
        </Tile>
      </div>

      <div className="space-y-4 p-5">
        {conflicts.length > 0 ? (
          <div className={cn("rounded-2xl border-2 p-4", ack ? "border-amber-300 bg-amber-50" : "border-red-500 bg-red-50")}>
            <div className="flex items-start gap-3">
              <ShieldAlert className={cn("mt-0.5 size-7 shrink-0", ack ? "text-amber-600" : "text-red-600")} />
              <div className="flex-1">
                <p className={cn("text-base font-bold uppercase tracking-wide", ack ? "text-amber-800" : "text-red-700")}>{t("Alerte allergène")}</p>
                <p className={cn("mt-1 text-sm", ack ? "text-amber-900" : "text-red-800")}>
                  {rich(t("Allergie à {list}. Plats concernés : {dishes}"), {
                    list: <strong>{conflicts.map((a) => t(allergenLabel(a))).join(", ")}</strong>,
                    dishes: customer.conflictDishes.join(" · "),
                  })}
                </p>
                <Button size="md" variant={ack ? "secondary" : "dark"} className="mt-3" onClick={() => setAck((v) => !v)} aria-pressed={ack} disabled={isServed}>
                  {ack ? <><CircleCheck className="size-4 text-brand-600" /> {t("Plateau adapté vérifié")}</> : t("J'ai vérifié · plateau adapté remis")}
                </Button>
              </div>
            </div>
          </div>
        ) : user.allergens.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
            <TriangleAlert className="size-4 text-slate-400" /> {t("Allergies :")} {user.allergens.map((a) => <AllergenChip key={a} id={a} />)}
            <span className="text-slate-500">{t("— absentes du menu du jour")}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-700">
            <CircleCheck className="size-4" /> {t("Aucune allergie déclarée")}
          </div>
        )}

        {!active && (
          <div className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <Clock3 className="mt-0.5 size-4 shrink-0" /> {t("Repas impossible tant que l'administration n'a pas validé ce compte. Le rechargement reste possible.")}
          </div>
        )}
        {walkInBlocked && !isServed && <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">{t("Repas sans réservation désactivé par l'administration.")}</p>}

        {insufficient && <p className="flex items-center gap-2 font-semibold text-red-700"><CircleX className="size-5" /> {t("Solde insuffisant — il manque {amount:money}", { amount: price - user.balance })}</p>}

        <div className="rounded-2xl border border-slate-200 p-4">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Banknote className="size-4 text-brand-600" /> {t("Rechargement en espèces")}
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {CASH_TOPUP_PRESETS.map((a) => (
              <Button key={a} variant="secondary" size="lg" disabled={pending} onClick={() => topUp(a)}>
                +{num(a)}
              </Button>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <input
              inputMode="numeric"
              value={custom}
              onChange={(e) => setCustom(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder={t("Autre montant ({min} – {max})…", { min: num(TOPUP_MIN), max: num(TOPUP_MAX) })}
              aria-label={t("Autre montant en FCFA")}
              className={inputCls}
            />
            <Button variant="dark" disabled={pending || customValue < TOPUP_MIN || customValue > TOPUP_MAX} onClick={() => topUp(customValue)}>
              {t("Encaisser")}
            </Button>
          </div>
        </div>

        {served && isServed && (
          <div className="flex items-center gap-3 rounded-2xl bg-brand-600 p-4 text-white animate-[pop_250ms_ease-out]">
            <CircleCheck className="size-8 shrink-0" />
            <div>
              <p className="text-lg font-semibold">{t("Repas validé · −{amount:money}", { amount: served.price })}</p>
              <p className="text-sm text-brand-50">{t("Nouveau solde : {balance:money}", { balance: served.balance })}</p>
            </div>
          </div>
        )}

        {isServed ? (
          <Button size="xl" variant="dark" className="w-full" onClick={onClear}>
            {t("Usager suivant")}
          </Button>
        ) : (
          <Button size="xl" className={cn("w-full", !reservation && canServe && "bg-amber-500 hover:bg-amber-600 active:bg-amber-700")} disabled={!canServe || pending} onClick={serve}>
            <CircleCheck className="size-6" />
            {!customer.hasMenu
              ? t("Aucun menu publié aujourd'hui")
              : !active
                ? t("Compte non validé")
                : blockedByAllergen
                  ? t("Vérifiez l'alerte allergène")
                  : insufficient
                    ? t("Solde insuffisant")
                    : reservation
                      ? t("Valider le repas · {price:money}", { price })
                      : t("Valider sans réservation · {price:money}", { price })}
          </Button>
        )}
      </div>
    </Card>
  );
}

function Tile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-4 py-4 sm:px-5">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-1.5 text-xl font-semibold sm:text-2xl">{children}</div>
    </div>
  );
}
