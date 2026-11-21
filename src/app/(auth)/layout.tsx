import type { Viewport } from "next";
import { BellRing, ShieldCheck, Smartphone } from "lucide-react";
import { Brand } from "@/components/brand";
import { AuthTabs } from "@/components/auth/AuthTabs";
import { ProductPreview } from "@/components/auth/ProductPreview";
import { LangSwitch } from "@/components/LangSwitch";
import { getI18n } from "@/i18n/server";
import { delay } from "@/lib/utils";

/** Barre du navigateur mobile assortie à l'en-tête vert profond */
export const viewport: Viewport = { themeColor: "#022c22" };

const FEATURES = [
  { icon: ShieldCheck, title: "Allergies vérifiées", text: "Alerte bloquante en caisse" },
  { icon: Smartphone, title: "Mobile Money", text: "Wave et Orange Money" },
  { icon: BellRing, title: "Suivi parental", text: "Repas et solde en direct" },
];

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const { t } = await getI18n();
  return (
    <div className="min-h-dvh bg-[var(--page)] lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:p-3">
      {/* Panneau de marque */}
      <aside className="relative hidden overflow-hidden rounded-[1.75rem] bg-emerald-950 text-white lg:flex lg:flex-col">
        <div className="bg-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_60%_45%,black_20%,transparent_75%)]" aria-hidden />
        <div className="pointer-events-none absolute -right-24 top-1/3 size-[30rem] rounded-full bg-emerald-500/20 blur-3xl" aria-hidden />
        <div className="relative flex flex-1 flex-col px-12 py-10 xl:px-16">
          <Brand light size="md" />
          <div className="mt-14 max-w-lg">
            {/* Accroche visuelle, pas un titre : le seul h1 de la page est dans le formulaire */}
            <p className="anim-rise font-display text-[2.6rem] font-bold leading-[1.05] tracking-tight xl:text-5xl" style={delay(100)}>
              {t("Le déjeuner,")}
              <br />
              <span className="text-emerald-300">{t("sans la file d'attente.")}</span>
            </p>
            <p className="anim-rise mt-4 max-w-md text-[15px] leading-relaxed text-emerald-50/70" style={delay(200)}>
              {t("Menus de la semaine, réservation en un geste, portefeuille rechargeable et pass QR : le restaurant universitaire tient dans votre poche.")}
            </p>
          </div>
          <div className="my-auto py-10">
            <ProductPreview />
          </div>
          <ul className="grid grid-cols-3 gap-4 border-t border-white/10 pt-6">
            {FEATURES.map((f, i) => (
              <li key={f.title} className="anim-rise" style={delay(900 + i * 80)}>
                <f.icon className="size-5 text-emerald-300" />
                <p className="mt-2 text-sm font-semibold">{t(f.title)}</p>
                <p className="text-xs text-emerald-50/60">{t(f.text)}</p>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {/* Formulaire */}
      <a
        href="#formulaire"
        className="fixed left-3 top-3 z-[70] -translate-y-20 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-emerald-950 shadow-lg transition-transform focus-visible:translate-y-0 focus-visible:outline-2 focus-visible:outline-emerald-500"
      >
        {t("Aller au formulaire")}
      </a>
      <main className="flex min-h-dvh flex-col lg:min-h-0">
        <header className="relative overflow-hidden bg-emerald-950 px-5 pb-10 pt-6 text-white lg:hidden">
          <div className="bg-grid pointer-events-none absolute inset-0 [mask-image:linear-gradient(to_bottom,black,transparent)]" aria-hidden />
          <div className="relative">
            <div className="flex items-center justify-between gap-3">
              <Brand light size="sm" />
              <LangSwitch tone="dark" />
            </div>
            <p className="mt-6 font-display text-[1.65rem] font-bold leading-tight tracking-tight">
              {t("Le déjeuner,")} <span className="text-emerald-300">{t("sans la file d'attente.")}</span>
            </p>
          </div>
          <div className="ticket-edge absolute inset-x-0 -bottom-px text-[var(--page)]" aria-hidden />
        </header>
        <div className="hidden justify-end px-8 pt-6 lg:flex">
          <LangSwitch />
        </div>
        <div className="flex flex-1 items-start justify-center px-5 pb-10 pt-6 sm:px-8 lg:items-center lg:py-10">
          <div id="formulaire" tabIndex={-1} className="w-full max-w-[25rem] outline-none">
            <div className="anim-rise" style={delay(0)}>
              <AuthTabs />
            </div>
            <div className="mt-8">{children}</div>
          </div>
        </div>
        <footer className="px-5 pb-6 text-center text-xs text-slate-500">{t("Mots de passe chiffrés · Sessions sécurisées · Données de santé protégées")}</footer>
      </main>
    </div>
  );
}
