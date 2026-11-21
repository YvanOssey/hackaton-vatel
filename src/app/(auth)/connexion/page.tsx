import type { Metadata } from "next";
import { TriangleAlert } from "lucide-react";
import { prisma } from "@/server/db";
import { LoginForm } from "./LoginForm";
import { rich } from "@/i18n/rich";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t("Connexion") };
}
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const { t } = await getI18n();
  const hasAdmin = (await prisma.user.count({ where: { role: "ADMIN", status: "ACTIVE" } })) > 0;
  return (
    <>
      {!hasAdmin && (
        <div className="mb-6 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <TriangleAlert className="mt-0.5 size-5 shrink-0 text-amber-600" />
          <div>
            <p className="font-semibold">{t("Installation incomplète : aucun administrateur")}</p>
            <p className="mt-1">
              {rich(t("Renseignez {email} et {password} (10 caractères minimum, lettres et chiffres) puis lancez {cmd}."), {
                email: <code>ADMIN_EMAIL</code>,
                password: <code>ADMIN_PASSWORD</code>,
                cmd: <code>npm run db:seed</code>,
              })}
            </p>
          </div>
        </div>
      )}
      <LoginForm />
    </>
  );
}
