import { Clock3 } from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";
import { requireUser } from "@/server/auth";
import { getI18n } from "@/i18n/server";

export const dynamic = "force-dynamic";

export default async function ConsumerLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser(["CONSUMER"]);
  const { t } = await getI18n();
  return (
    <AppShell
      user={user}
      nav={[
        { href: "/espace", label: "Menus & réservations", short: "Menus", icon: "menu" },
        { href: "/espace/portefeuille", label: "Portefeuille", icon: "wallet" },
        { href: "/espace/pass", label: "Mon pass", short: "Pass", icon: "pass" },
        { href: "/espace/profil", label: "Profil & famille", short: "Profil", icon: "profile" },
      ]}
    >
      {user.status === "PENDING" && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <Clock3 className="mt-0.5 size-5 shrink-0 text-amber-600" />
          <div>
            <p className="font-semibold">{t("Compte en attente de validation")}</p>
            <p className="mt-0.5">
              {t("L'administration vérifie votre numéro étudiant. En attendant, vous pouvez consulter les menus et recharger votre portefeuille au comptoir ; les réservations et les repas seront possibles après validation.")}
            </p>
          </div>
        </div>
      )}
      {children}
    </AppShell>
  );
}
