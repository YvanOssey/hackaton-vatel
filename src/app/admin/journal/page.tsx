import type { Metadata } from "next";
import { ScrollText } from "lucide-react";
import { Card, CardHeader, EmptyState, PageTitle } from "@/components/ui";
import { ROLES } from "@/lib/constants";
import { requireUser } from "@/server/auth";
import { env } from "@/server/env";
import { auditTrail } from "@/server/services/queries";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t("Journal d'audit") };
}

const LABELS: Record<string, string> = {
  "user.register": "Inscription",
  "user.register_parent": "Inscription parent",
  "wallet.online_topup": "Rechargement Mobile Money",
  "family.code_created": "Code d'association généré",
  "family.link": "Association parent",
  "family.unlink": "Fin d'association parent",
  "user.approve": "Validation d'inscription",
  "user.reject": "Refus d'inscription",
  "user.suspend": "Suspension de compte",
  "user.reactivate": "Réactivation de compte",
  "user.change_group": "Changement de catégorie",
  "user.create_staff": "Création de compte personnel",
  "user.reset_password": "Réinitialisation de mot de passe",
  "user.change_password": "Changement de mot de passe",
  "user.update_allergens": "Mise à jour des allergies",
  "pass.regenerate": "Nouveau QR Code",
  "wallet.adjust": "Ajustement de portefeuille",
  "settings.update": "Modification des paramètres",
  "menu.publish": "Publication de menu",
  "menu.unpublish": "Dépublication de menu",
  "menu.save_draft": "Brouillon de menu",
  "menu.delete": "Suppression de menu",
  "cash.open": "Ouverture de caisse",
  "cash.close": "Clôture de caisse",
  "stock.adjust": "Mouvement de stock",
};

export default async function AuditPage() {
  const logs = await auditTrail(await requireUser(["ADMIN"]));
  const { t, dateTime } = await getI18n();
  return (
    <>
      <PageTitle eyebrow={t("Administration")} title={t("Journal d'audit")} />
      <Card>
        <CardHeader title={t("200 dernières actions")} subtitle={t("Actions sensibles : comptes, argent, menus, caisse, paramètres")} icon={<ScrollText className="size-4" />} />
        {logs.length === 0 ? (
          <EmptyState icon={<ScrollText className="size-6" />} title={t("Aucune action enregistrée")} />
        ) : (
          <ul className="divide-y divide-slate-100">
            {logs.map((l) => (
              <li key={l.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-5 py-3 text-sm">
                <span className="w-32 shrink-0 tabular-nums text-slate-500">{dateTime(l.createdAt, env.timezone)}</span>
                <span className="font-medium text-slate-800">{LABELS[l.action] ? t(LABELS[l.action]) : l.action}</span>
                <span className="text-slate-500">{l.actor ? t("par {name} ({role})", { name: `${l.actor.firstName} ${l.actor.lastName}`, role: t(ROLES[l.actor.role].label) }) : t("système")}</span>
                {l.details && l.action !== "settings.update" && <code className="min-w-0 flex-1 truncate text-xs text-slate-500">{JSON.stringify(l.details)}</code>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
