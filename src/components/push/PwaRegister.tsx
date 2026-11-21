"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { useI18n } from "@/i18n/client";

type InstallEvent = Event & { prompt: () => Promise<void> };

/** Enregistre le service worker (hors ligne) et propose « Installer l'application » quand le navigateur le permet */
export function PwaRegister() {
  const { t } = useI18n();
  const [install, setInstall] = useState<InstallEvent | null>(null);

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstall(e as InstallEvent);
    };
    const onInstalled = () => setInstall(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!install) return null;
  return (
    <button
      type="button"
      onClick={() => install.prompt().then(() => setInstall(null))}
      className="fixed bottom-24 right-4 z-40 inline-flex min-h-11 items-center gap-2 rounded-full bg-brand-950 px-4 text-sm font-semibold text-white shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400 md:bottom-6"
    >
      <Download className="size-4" /> {t("Installer l'application")}
    </button>
  );
}
