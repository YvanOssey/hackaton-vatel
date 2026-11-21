import type { Metadata } from "next";
import { Clock3, ScanLine, ShieldCheck, Wallet } from "lucide-react";
import { PassCard } from "@/components/espace/PassCard";
import { AllergenChip, Card, PageTitle } from "@/components/ui";
import { cn } from "@/lib/utils";
import { requireUser } from "@/server/auth";
import { consumerPass } from "@/server/services/queries";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t("Mon pass") };
}

export default async function PassPage() {
  const { token, user } = await consumerPass(await requireUser(["CONSUMER"]));
  const { t, money } = await getI18n();
  return (
    <>
      {/* « QR Code » est joint par une espace insécable (U+00A0), ici et dans en.ts : le titre ne se coupe pas entre les deux mots */}
      <PageTitle eyebrow={t("Pass numérique")} title={t("Présentez ce QR Code en caisse")} />
      <div className="mx-auto grid grid-cols-1 max-w-4xl items-start gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
        {token ? (
          <PassCard token={token} user={{ id: user.id, firstName: user.firstName, lastName: user.lastName }} memberRef={user.memberRef} />
        ) : (
          <Card className="flex flex-col items-center p-10 text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 ring-1 ring-amber-600/15">
              <Clock3 className="size-6" />
            </span>
            <p className="mt-4 font-display text-lg font-semibold text-slate-900">{t("Pass disponible après validation")}</p>
            <p className="mt-1 max-w-xs text-sm text-slate-500">{t("Votre QR Code sera généré dès que l'administration aura vérifié votre numéro étudiant.")}</p>
          </Card>
        )}
        <div className="space-y-4">
          <Card className="anim-rise flex items-center gap-3 p-4" style={{ "--d": "80ms" } as React.CSSProperties}>
            <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <Wallet className="size-5" />
            </span>
            <div>
              <p className="text-xs text-slate-500">{t("Solde")}</p>
              <p className="font-display text-lg font-bold tabular-nums text-slate-900">{money(user.balance)}</p>
            </div>
          </Card>
          <Card className="anim-rise p-4" style={{ "--d": "140ms" } as React.CSSProperties}>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t("Allergies signalées en caisse")}</p>
            <div className={cn("mt-2 flex flex-wrap gap-1.5")}>
              {user.allergens.length ? user.allergens.map((a) => <AllergenChip key={a} id={a} highlight />) : <span className="text-sm text-slate-500">{t("Aucune")}</span>}
            </div>
          </Card>
          <ol className="anim-rise space-y-3 px-1 text-sm text-slate-600" style={{ "--d": "200ms" } as React.CSSProperties}>
            <li className="flex gap-3">
              <ScanLine className="mt-0.5 size-4 shrink-0 text-emerald-600" /> {t("Le caissier scanne votre code : votre repas réservé est débité.")}
            </li>
            <li className="flex gap-3">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" /> {t("Code signé et personnel : tout code modifié est refusé. En cas de doute, générez-en un nouveau.")}
            </li>
          </ol>
        </div>
      </div>
    </>
  );
}
