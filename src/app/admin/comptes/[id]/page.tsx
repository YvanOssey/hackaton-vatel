import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Receipt } from "lucide-react";
import { AccountActions } from "@/components/admin/AccountActions";
import { AllergenChip, Avatar, Badge, Card, CardHeader, EmptyState } from "@/components/ui";
import { METHODS, ROLES, STATUSES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { requireUser } from "@/server/auth";
import { env } from "@/server/env";
import { AppError } from "@/server/errors";
import { userDetail } from "@/server/services/queries";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t("Compte") };
}

export default async function AccountPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireUser(["ADMIN"]);
  const { id } = await params;
  const { t, money, dateTime, note } = await getI18n();
  const user = await userDetail(actor, id).catch((e) => {
    if (e instanceof AppError) notFound();
    throw e;
  });
  return (
    <>
      <Link href="/admin/comptes?vue=usagers" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft className="size-4" /> {t("Comptes")}
      </Link>
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <Avatar user={user} size="lg" />
        <div className="flex-1">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            {user.firstName} {user.lastName}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <Badge tone="info">{t(ROLES[user.role].label)}</Badge>
            <Badge tone={STATUSES[user.status].tone}>{t(STATUSES[user.status].label)}</Badge>
            <span>{user.email}</span>
          </div>
        </div>
        {user.role === "CONSUMER" && (
          <div className="text-right">
            <p className="text-sm text-slate-500">{t("Solde")}</p>
            <p className="text-3xl font-semibold tabular-nums text-slate-900">{money(user.balance)}</p>
          </div>
        )}
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <Card>
            <CardHeader title={t("Informations")} />
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 p-5 text-sm sm:grid-cols-2">
              {[
                [t("Téléphone"), user.phone ?? "—"],
                [t("N° étudiant"), user.memberRef ?? "—"],
                [t("Inscrit le"), dateTime(user.createdAt, env.timezone)],
                [t("Décision"), user.reviewedAt ? `${dateTime(user.reviewedAt, env.timezone)}${user.reviewNote ? ` · ${user.reviewNote}` : ""}` : "—"],
                [t("Mot de passe provisoire"), user.mustChangePassword ? t("Oui, à changer") : t("Non")],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-slate-500">{k}</dt>
                  <dd className="font-medium text-slate-900">{v}</dd>
                </div>
              ))}
              <div className="sm:col-span-2">
                <dt className="text-slate-500">{t("Allergies")}</dt>
                <dd className="mt-1 flex flex-wrap gap-1">{user.allergens.length ? user.allergens.map((a) => <AllergenChip key={a} id={a} highlight />) : t("Aucune")}</dd>
              </div>
            </dl>
          </Card>
          {user.role === "CONSUMER" && (
            <Card>
              <CardHeader title={t("Opérations du portefeuille")} subtitle={t("50 dernières")} icon={<Receipt className="size-4" />} />
              {user.transactions.length === 0 ? (
                <EmptyState icon={<Receipt className="size-6" />} title={t("Aucune opération")} />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {user.transactions.map((tx) => (
                    <li key={tx.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-slate-800">{t(tx.label)}</p>
                        <p className="text-xs text-slate-500">
                          {dateTime(tx.createdAt, env.timezone)} · {t(METHODS[tx.method])}
                          {tx.operator && ` · ${t("par {name}", { name: `${tx.operator.firstName} ${tx.operator.lastName}` })}`}
                          {tx.note && ` · ${note(tx.note)}`}
                        </p>
                      </div>
                      <span className={cn("font-semibold tabular-nums", tx.amount > 0 ? "text-brand-600" : "text-slate-900")}>
                        {tx.amount > 0 ? "+" : ""}
                        {money(tx.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </div>
        <AccountActions user={{ id: user.id, role: user.role, status: user.status, isSelf: user.id === actor.id }} />
      </div>
    </>
  );
}
