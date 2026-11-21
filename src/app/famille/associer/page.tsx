import type { Metadata } from "next";
import { KeyRound, Smartphone, UserCheck } from "lucide-react";
import { LinkChildForm } from "@/components/famille/LinkChildForm";
import { Card, PageTitle } from "@/components/ui";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t("Associer un enfant") };
}

const STEPS = [
  { icon: Smartphone, title: "Votre enfant ouvre son profil", text: "Dans CantineConnect : Profil & famille → « Générer un code »." },
  { icon: KeyRound, title: "Il vous transmet le code", text: "8 caractères, à usage unique, valable 48 heures." },
  { icon: UserCheck, title: "Vous le saisissez ici", text: "Vous voyez aussitôt son solde, ses réservations et ses repas." },
];

export default async function LinkChildPage() {
  const { t } = await getI18n();
  return (
    <>
      <PageTitle eyebrow={t("Famille")} title={t("Associer le compte de votre enfant")} />
      <div className="grid grid-cols-1 max-w-4xl gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <ol className="space-y-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="anim-rise flex gap-4 rounded-2xl bg-white p-4 ring-1 ring-slate-900/[0.06]" style={{ "--d": `${i * 70}ms` } as React.CSSProperties}>
              <span className="relative flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                <s.icon className="size-5" />
                <span className="absolute -left-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-brand-950 text-[11px] font-bold text-white">{i + 1}</span>
              </span>
              <div>
                <p className="font-display font-semibold text-slate-900">{t(s.title)}</p>
                <p className="text-sm text-slate-500">{t(s.text)}</p>
              </div>
            </li>
          ))}
        </ol>
        <Card className="anim-rise h-fit p-5" style={{ "--d": "200ms" } as React.CSSProperties}>
          <LinkChildForm />
          <p className="mt-4 text-xs text-slate-500">{t("Par sécurité, seul l'étudiant peut autoriser un parent. Il peut retirer cette autorisation à tout moment.")}</p>
        </Card>
      </div>
    </>
  );
}
