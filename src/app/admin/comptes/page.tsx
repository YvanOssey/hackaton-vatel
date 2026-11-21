import type { Metadata } from "next";
import Link from "next/link";
import type { AccountStatus, Role } from "@prisma/client";
import { Search, Users } from "lucide-react";
import { PendingReview } from "@/components/admin/PendingReview";
import { StaffForm } from "@/components/admin/StaffForm";
import { AllergenChip, Avatar, Badge, Card, CardHeader, EmptyState, PageTitle } from "@/components/ui";
import { inputCls } from "@/lib/styles";
import { ROLES, STATUSES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { requireUser } from "@/server/auth";
import { listUsers } from "@/server/services/queries";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t("Comptes") };
}

const VIEWS: Record<string, { label: string; filter: { status?: AccountStatus; role?: Role } }> = {
  attente: { label: "En attente", filter: { status: "PENDING", role: "CONSUMER" } },
  usagers: { label: "Étudiants", filter: { role: "CONSUMER" } },
  parents: { label: "Parents", filter: { role: "PARENT" } },
  personnel: { label: "Personnel", filter: {} },
  suspendus: { label: "Suspendus", filter: { status: "SUSPENDED" } },
};

export default async function AccountsPage({ searchParams }: { searchParams: Promise<{ vue?: string; q?: string }> }) {
  const actor = await requireUser(["ADMIN"]);
  const sp = await searchParams;
  const { t, money } = await getI18n();
  const view = sp.vue && sp.vue in VIEWS ? sp.vue : "attente";
  let users = await listUsers(actor, { ...VIEWS[view].filter, q: sp.q });
  if (view === "personnel") users = users.filter((u) => u.role !== "CONSUMER" && u.role !== "PARENT");

  return (
    <>
      <PageTitle eyebrow={t("Administration")} title={t("Comptes")} />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <nav className="flex max-w-full overflow-x-auto rounded-xl bg-slate-100 p-1 [scrollbar-width:none]">
              {Object.entries(VIEWS).map(([key, v]) => (
                <Link key={key} href={`/admin/comptes?vue=${key}`} className={cn("shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium", view === key ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900")}>
                  {t(v.label)}
                </Link>
              ))}
            </nav>
            <form className="relative min-w-[200px] flex-1">
              <input type="hidden" name="vue" value={view} />
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <input name="q" defaultValue={sp.q} placeholder={t("Nom, e-mail, matricule…")} className={inputCls + " pl-9"} />
            </form>
          </div>

          {view === "attente" ? (
            users.length === 0 ? (
              <Card>
                <EmptyState icon={<Users className="size-6" />} title={t("Aucune inscription en attente")} />
              </Card>
            ) : (
              <div className="space-y-3">
                {users.map((u) => (
                  <PendingReview key={u.id} user={{ ...u, createdAt: u.createdAt.toISOString() }} />
                ))}
              </div>
            )
          ) : (
            <Card>
              <CardHeader title={t(VIEWS[view].label)} subtitle={t("{count} compte(s)", { count: users.length })} />
              {users.length === 0 ? (
                <EmptyState icon={<Users className="size-6" />} title={t("Aucun compte")} />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {users.map((u) => (
                    <li key={u.id}>
                      <Link href={`/admin/comptes/${u.id}`} className="flex flex-wrap items-center gap-3 px-5 py-3 hover:bg-slate-50">
                        <Avatar user={u} size="sm" />
                        <div className="min-w-[180px] flex-1">
                          <p className="text-sm font-medium text-slate-800">
                            {u.firstName} {u.lastName}
                          </p>
                          <p className="text-xs text-slate-500">
                            {u.email}
                            {u.memberRef && ` · ${t("N° {ref}", { ref: u.memberRef })}`}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {u.allergens.slice(0, 3).map((a) => (
                            <AllergenChip key={a} id={a} />
                          ))}
                        </div>
                        {u.role !== "CONSUMER" && <Badge tone="info">{t(ROLES[u.role].label)}</Badge>}
                        <Badge tone={STATUSES[u.status].tone}>{t(STATUSES[u.status].label)}</Badge>
                        {u.role === "CONSUMER" && <span className="w-24 text-right text-sm font-semibold tabular-nums text-slate-900">{money(u.balance)}</span>}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </div>
        <div className="space-y-5">
          <StaffForm />
          <Card className="p-5 text-sm text-slate-600">
            <p className="font-semibold text-slate-900">{t("Validation des étudiants")}</p>
            <p className="mt-1">{t("Un étudiant inscrit ne peut ni réserver ni être servi tant que son compte n'est pas validé. Vérifiez son numéro étudiant (carte, liste de scolarité) avant de valider.")}</p>
          </Card>
        </div>
      </div>
    </>
  );
}
