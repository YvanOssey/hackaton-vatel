"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { BellOff, BellRing, LoaderCircle, Send, Share, Smartphone } from "lucide-react";
import { subscribePushAction, testPushAction, unsubscribePushAction } from "@/app/actions/push";
import { useResultToast, useToast } from "@/components/toast";
import { Button } from "@/components/ui";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";

type PushState = "loading" | "unsupported" | "ios-install" | "unconfigured" | "denied" | "off" | "on";

function keyToBytes(base64: string) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** Certains navigateurs ne répondent jamais à l'abonnement (service de push injoignable) */
function withTimeout<T>(p: Promise<T>, ms = 15_000) {
  return Promise.race([p, new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms))]);
}

const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

/** État des notifications push de cet appareil, et actions pour les activer ou les couper */
export function usePush(publicKey: string | null) {
  const [state, setState] = useState<PushState>("loading");
  const [pending, start] = useTransition();
  const toast = useToast();
  const { t } = useI18n();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      if (!supported) return setState(isIos() && !isStandalone() ? "ios-install" : "unsupported");
      if (!publicKey) return setState("unconfigured");
      if (Notification.permission === "denied") return setState("denied");
      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        const sub = await reg.pushManager.getSubscription();
        if (cancelled) return;
        setState(sub && Notification.permission === "granted" ? "on" : "off");
        // Rattache l'appareil au compte connecté (un autre compte a pu l'utiliser avant)
        if (sub && Notification.permission === "granted") void subscribePushAction(sub.toJSON());
      } catch {
        if (!cancelled) setState("unsupported");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [publicKey]);

  const enable = useCallback(
    () =>
      start(async () => {
        if (!publicKey) return;
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setState(permission === "denied" ? "denied" : "off");
          return;
        }
        try {
          const reg = await navigator.serviceWorker.register("/sw.js");
          await navigator.serviceWorker.ready;
          const sub = (await reg.pushManager.getSubscription()) ?? (await withTimeout(reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(publicKey) })));
          const res = await subscribePushAction(sub.toJSON());
          if (!res.ok) {
            await sub.unsubscribe();
            toast({ tone: "error", title: t("Action refusée"), description: res.message });
            return setState("off");
          }
          setState("on");
          toast({ tone: "success", title: t("Notifications activées"), description: res.message });
        } catch {
          toast({ tone: "error", title: t("Activation impossible"), description: t("Ce navigateur a refusé l'abonnement. Réessayez ou utilisez Chrome, Edge ou Safari.") });
          setState("off");
        }
      }),
    [publicKey, t, toast],
  );

  const disable = useCallback(
    () =>
      start(async () => {
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = await reg?.pushManager.getSubscription();
        if (sub) {
          await unsubscribePushAction(sub.endpoint);
          await sub.unsubscribe();
        }
        setState("off");
      }),
    [],
  );

  return { state, pending, enable, disable };
}

function Switch({ on, disabled, onClick, label }: { on: boolean; disabled?: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:opacity-50",
        on ? "bg-emerald-600" : "bg-slate-300",
      )}
    >
      <span className={cn("inline-block size-5 rounded-full bg-white shadow transition-transform duration-200 ease-[var(--ease-spring)]", on ? "translate-x-[22px]" : "translate-x-0.5")} />
    </button>
  );
}

/** Ligne compacte du menu du compte */
export function PushMenuRow({ publicKey }: { publicKey: string | null }) {
  const { t } = useI18n();
  const { state, pending, enable, disable } = usePush(publicKey);
  if (state === "loading" || state === "unconfigured") return null;
  const usable = state === "on" || state === "off";
  return (
    <div className="flex items-center justify-between gap-3 px-3 pb-2">
      <span className="min-w-0">
        <span className="block text-xs font-medium text-slate-500">{t("Notifications push")}</span>
        {!usable && (
          <span className="block text-[11px] leading-tight text-slate-500">
            {state === "denied" ? t("Bloquées dans le navigateur") : state === "ios-install" ? t("Ajoutez l'app à l'écran d'accueil") : t("Non prises en charge ici")}
          </span>
        )}
      </span>
      {usable && <Switch on={state === "on"} disabled={pending} onClick={state === "on" ? disable : enable} label={t("Notifications push")} />}
    </div>
  );
}

/** Carte des pages profil (étudiant) et suivi (parent) */
export function PushCard({ publicKey, audience }: { publicKey: string | null; audience: "student" | "parent" }) {
  const { t } = useI18n();
  const show = useResultToast();
  const { state, pending, enable, disable } = usePush(publicKey);
  const [testing, startTest] = useTransition();
  if (state === "unconfigured") return null;
  const on = state === "on";

  return (
    <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-900/[0.06] shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-18px_rgba(15,23,42,0.12)]">
      <div className="flex items-start gap-4 p-5">
        <span className={cn("relative flex size-11 shrink-0 items-center justify-center rounded-xl transition-colors", on ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-500")}>
          {on ? <BellRing className="size-5" /> : <BellOff className="size-5" />}
          {on && <span className="anim-ping-soft absolute inset-0 rounded-xl bg-emerald-500/40" aria-hidden />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display font-semibold text-slate-900">{t("Notifications sur cet appareil")}</p>
          <p className="mt-0.5 text-sm text-slate-500">
            {audience === "parent"
              ? t("Soyez prévenu quand votre enfant déjeune, quand son solde baisse et à chaque rechargement.")
              : t("Validation du compte, rechargements et solde bas, même application fermée.")}
          </p>
        </div>
        {(state === "on" || state === "off") && <Switch on={on} disabled={pending} onClick={on ? disable : enable} label={t("Notifications sur cet appareil")} />}
        {state === "loading" && <LoaderCircle className="size-5 animate-spin text-slate-400" />}
      </div>

      {state === "on" && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-emerald-50/50 px-5 py-3">
          <span className="text-sm font-medium text-emerald-800">{t("Activées sur cet appareil")}</span>
          <Button size="sm" variant="secondary" disabled={testing} onClick={() => startTest(async () => void show(await testPushAction(), "Test envoyé"))}>
            {testing ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />} {t("Envoyer un test")}
          </Button>
        </div>
      )}
      {state === "off" && (
        <div className="border-t border-slate-100 px-5 py-3">
          <Button className="w-full sm:w-auto" disabled={pending} onClick={enable}>
            {pending ? <LoaderCircle className="size-4 animate-spin" /> : <BellRing className="size-4" />} {t("Activer les notifications")}
          </Button>
        </div>
      )}
      {state === "denied" && (
        <p className="border-t border-slate-100 bg-amber-50 px-5 py-3 text-sm text-amber-900">
          {t("Les notifications sont bloquées pour ce site. Autorisez-les dans les réglages du navigateur (icône à gauche de l'adresse), puis rechargez la page.")}
        </p>
      )}
      {state === "ios-install" && (
        <p className="flex items-start gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3 text-sm text-slate-600">
          <Share className="mt-0.5 size-4 shrink-0 text-slate-400" />
          {t("Sur iPhone : touchez Partager puis « Sur l'écran d'accueil », ouvrez CantineConnect depuis l'icône et activez les notifications ici.")}
        </p>
      )}
      {state === "unsupported" && (
        <p className="flex items-start gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3 text-sm text-slate-600">
          <Smartphone className="mt-0.5 size-4 shrink-0 text-slate-400" />
          {t("Ce navigateur ne prend pas en charge les notifications push. Elles restent visibles dans la cloche de l'application.")}
        </p>
      )}
    </div>
  );
}
