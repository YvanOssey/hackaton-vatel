import type { Metadata } from "next";
import { HeartHandshake, ShieldPlus, UserRound } from "lucide-react";
import { FamilyLinks } from "@/components/espace/FamilyLinks";
import { PushCard } from "@/components/push/PushControls";
import { pushPublicKey } from "@/server/push";
import { ProfileForm } from "@/components/espace/ProfileForm";
import { Avatar, Badge, Card, CardHeader, PageTitle } from "@/components/ui";
import { STATUSES } from "@/lib/constants";
import { requireUser } from "@/server/auth";
import { studentFamily } from "@/server/services/family";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t("Profil") };
}

export default async function ProfilePage() {
  const user = await requireUser(["CONSUMER"]);
  const family = await studentFamily(user);
  const { t } = await getI18n();
  const status = STATUSES[user.status];
  return (
    <>
      <PageTitle eyebrow={t("Profil")} title={t("Mes informations")} />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="space-y-5">
          <Card className="anim-rise">
            <div className="flex items-center gap-4 p-5">
              <Avatar user={user} size="lg" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-lg font-bold text-slate-900">
                  {user.firstName} {user.lastName}
                </p>
                <p className="truncate text-sm text-slate-500">{user.email}</p>
              </div>
              <Badge tone={status.tone}>{t(status.label)}</Badge>
            </div>
            <dl className="grid grid-cols-2 border-t border-slate-100 text-sm">
              <div className="border-r border-slate-100 px-5 py-3">
                <dt className="text-xs text-slate-500">{t("N° étudiant")}</dt>
                <dd translate="no" className="mt-0.5 font-mono font-medium text-slate-900">
                  {user.memberRef ?? "—"}
                </dd>
              </div>
              <div className="px-5 py-3">
                <dt className="text-xs text-slate-500">{t("Profil")}</dt>
                <dd className="mt-0.5 flex items-center gap-1.5 font-medium text-slate-900">
                  <UserRound className="size-3.5 text-slate-400" />{" "}
                  {t("Étudiant")}
                </dd>
              </div>
            </dl>
            <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
              {t(
                "Nom, e-mail et numéro étudiant sont modifiables par l'administration uniquement.",
              )}
            </p>
          </Card>
          <Card
            className="anim-rise"
            style={{ "--d": "80ms" } as React.CSSProperties}
          >
            <CardHeader
              title={t("Santé et contact")}
              subtitle={t(
                "Vos allergies déclenchent une alerte bloquante en caisse",
              )}
              icon={<ShieldPlus className="size-4" />}
            />
            <ProfileForm phone={user.phone ?? ""} allergens={user.allergens} />
          </Card>
        </div>
        <div className="space-y-5">
          <div
            className="anim-rise"
            style={{ "--d": "120ms" } as React.CSSProperties}
          >
            <PushCard publicKey={pushPublicKey()} audience="student" />
          </div>
          <Card
            className="anim-rise h-fit"
            style={{ "--d": "180ms" } as React.CSSProperties}
          >
            <CardHeader
              title={t("Famille")}
              subtitle={t("Parents autorisés à suivre votre compte")}
              icon={<HeartHandshake className="size-4" />}
            />
            <FamilyLinks
              parents={family.parents}
              activeCodeExpiresAt={family.activeCodeExpiresAt}
            />
          </Card>
        </div>
      </div>
    </>
  );
}
