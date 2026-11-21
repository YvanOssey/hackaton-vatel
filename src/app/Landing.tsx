import Link from "next/link";
import { CalendarCheck, QrCode, Smartphone } from "lucide-react";
import { CoBrand, VatelLogo } from "@/components/landing/VatelBrand";
import { LangSwitch } from "@/components/LangSwitch";
import { ServiceHero } from "@/components/landing/ServiceHero";
import { COURSES, allergenLabel } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { I18n } from "@/i18n/core";
import type { publicMenuPreview } from "@/server/services/queries";

type Preview = Awaited<ReturnType<typeof publicMenuPreview>>;

/** Bleu Vatel lu par la scène 3D (liserés, contre-jour) : --color-brand-400 de globals.css */
const BRAND_BLUE = "#86c3ea";

const pill =
  "hit h-11 select-none items-center justify-center rounded-full px-5 text-sm font-medium tracking-wide transition-[background-color,color,transform] duration-150 active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-2";

/**
 * Page d'accueil publique, à la manière d'une maison gastronomique : l'accueil, la table dressée en 3D,
 * la cloche que l'on soulève sur le plat du jour, puis la carte et la réservation.
 */
export function Landing({ data, i18n }: { data: Preview; i18n: I18n }) {
  const { t, money, dayInline } = i18n;
  const menu = data.menu;
  const dish = (course: "STARTER" | "MAIN" | "DESSERT") => menu?.dishes.find((d) => d.course === course);
  const allergens = [...new Set(menu?.dishes.flatMap((d) => d.allergens) ?? [])].map((a) => t(allergenLabel(a)));
  const isToday = menu?.date === data.today;
  const when = menu ? (isToday ? t("Ce midi") : t("Au menu {day}", { day: dayInline(menu.date) })) : t("Menu à venir");

  const header = (
    <header className="mx-auto flex max-w-6xl items-center gap-3 px-5 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-8">
      <Link href="/" className="hit rounded-xl focus-visible:outline-2 focus-visible:outline-white" aria-label={t("Accueil")} translate="no">
        <CoBrand light />
      </Link>
      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        <LangSwitch tone="dark" />
        <Link href="/connexion" className={cn(pill, "hidden text-white/85 hover:bg-white/10 hover:text-white focus-visible:outline-white sm:inline-flex")}>
          {t("Se connecter")}
        </Link>
      </div>
    </header>
  );

  return (
    <div className="min-h-dvh bg-[var(--page)]">
      <a href="#carte" className="sr-only rounded-lg bg-white px-3 py-2 text-sm font-semibold focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50">
        {t("Aller au contenu")}
      </a>

      <ServiceHero
        brand={BRAND_BLUE}
        header={header}
        texts={{
          welcomeKicker: data.establishmentName,
          welcomeTitle: t("Votre table est prête."),
          welcomeLead: t("Réservez votre déjeuner, réglez d'un geste et laissez-vous servir, sans file d'attente."),
          lift: t("Soulever la cloche"),
          revealKicker: when,
          dish: dish("MAIN")?.name ?? null,
          sides: [dish("STARTER")?.name, dish("DESSERT")?.name].filter((x): x is string => !!x),
          allergens: allergens.length ? t("Contient {list}", { list: allergens.join(", ") }) : null,
          empty: t("La cuisine prépare le prochain menu."),
          cta: menu ? { href: "/connexion", label: t("Réserver ma table") } : { href: "/inscription", label: t("Créer un compte") },
        }}
      />

      {/* La carte du jour */}
      <main id="carte" tabIndex={-1} className="mx-auto max-w-6xl px-5 py-16 outline-none sm:px-8 sm:py-24">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-16">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.32em] text-brand-700">{t("La maison")}</p>
            <h2 className="mt-4 font-display text-4xl font-medium leading-[1.05] tracking-tight text-balance text-slate-900 sm:text-5xl">
              {t("Le service d'une grande table, au prix du restaurant universitaire.")}
            </h2>
            <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-pretty text-slate-600">
              {t("Menus de la semaine, réservation en un geste, portefeuille rechargeable et pass QR : le restaurant universitaire tient dans votre poche.")}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/inscription" className={cn(pill, "inline-flex h-12 bg-brand-950 px-6 text-white hover:bg-brand-900 focus-visible:outline-brand-600")}>
                {t("Créer un compte")}
              </Link>
              <Link href="/connexion" className={cn(pill, "inline-flex h-12 border border-slate-300 bg-white px-6 text-slate-800 hover:bg-slate-50 focus-visible:outline-brand-600")}>
                {t("Se connecter")}
              </Link>
            </div>
          </div>

          {/* Carte imprimée, avec les encoches du ticket */}
          <article className="ticket rounded-[2rem] bg-white px-7 pb-7 pt-9 text-center shadow-[0_1px_2px_rgba(15,23,42,0.05),0_40px_80px_-40px_rgba(29,29,27,0.35)] ring-1 ring-slate-900/[0.06] [--cut:calc(100%-104px)] sm:px-10" aria-labelledby="carte-titre">
            <VatelLogo height={44} className="mx-auto mb-5" />
            <p className="text-[11px] font-medium uppercase tracking-[0.32em] text-brand-700">{when}</p>
            <h2 id="carte-titre" className="mt-2 font-display text-3xl font-bold tracking-tight text-slate-900">
              {t("La carte")}
            </h2>
            <div className="mx-auto mt-4 h-px w-12 bg-brand-600" aria-hidden />
            {menu ? (
              <dl className="mt-6 space-y-5">
                {menu.dishes.map((d) => (
                  <div key={d.course}>
                    <dt className="text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-500">{t(COURSES[d.course])}</dt>
                    <dd className={cn("mt-1 font-display leading-snug text-balance text-slate-900", d.course === "MAIN" ? "text-2xl font-semibold" : "text-xl")}>{d.name}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="mt-6 font-display text-xl font-semibold tracking-tight text-slate-700">{t("Le prochain menu sera publié bientôt. Créez votre compte pour réserver dès sa publication.")}</p>
            )}
            {allergens.length > 0 && <p className="mt-6 text-xs font-semibold uppercase tracking-[0.14em] text-red-600">{t("Contient {list}", { list: allergens.join(", ") })}</p>}
            <div className="ticket-cut -mx-7 mt-8 sm:-mx-10" aria-hidden />
            <div className="mt-6 flex items-center justify-between gap-4">
              <div className="text-left">
                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{t("Tarif étudiant")}</p>
                <p className="font-display text-2xl font-semibold tabular-nums text-slate-900">{money(data.price)}</p>
              </div>
              <Link href={menu ? "/connexion" : "/inscription"} className={cn(pill, "inline-flex bg-brand-600 text-white hover:bg-brand-700 focus-visible:outline-brand-600")}>
                {menu ? t("Réserver ma table") : t("Créer un compte")}
              </Link>
            </div>
          </article>
        </div>

        {/* Le déroulé du service */}
        <section className="mt-24 border-t border-slate-200 pt-14" aria-labelledby="etapes-titre">
          <h2 id="etapes-titre" className="text-center font-display text-3xl font-bold tracking-tight text-slate-900">
            {t("Trois gestes, zéro file")}
          </h2>
          <ol className="mt-10 grid grid-cols-1 gap-10 text-center sm:grid-cols-3">
            {[
              { icon: CalendarCheck, title: t("Réservez"), body: t("Jusqu'à {days} jours à l'avance, et le jour même avant {time}.", { days: data.bookingHorizonDays, time: data.cutoffTime }) },
              { icon: Smartphone, title: t("Payez"), body: t("Rechargez par Wave ou Orange Money, ou en espèces au comptoir.") },
              { icon: QrCode, title: t("Présentez votre pass"), body: t("Le caissier scanne votre QR Code : votre repas est servi.") },
            ].map((s, i) => (
              <li key={s.title} className="min-w-0">
                <span className="mx-auto flex size-12 items-center justify-center rounded-full border border-brand-600/25 text-brand-700">
                  <s.icon className="size-5" strokeWidth={1.6} aria-hidden />
                </span>
                <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-500">{String(i + 1).padStart(2, "0")}</p>
                <p className="mt-1 font-display text-2xl font-medium text-slate-900">{s.title}</p>
                <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-slate-600">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <p className="mt-20 text-center text-xs text-slate-500">{t("Mots de passe chiffrés · Sessions sécurisées · Données de santé protégées")}</p>
      </main>
    </div>
  );
}
