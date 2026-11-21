import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, KeyRound } from "lucide-react";
import { Brand } from "@/components/brand";
import { LangSwitch } from "@/components/LangSwitch";
import { ROLES } from "@/lib/constants";
import { elides } from "@/lib/utils";
import { requireUser } from "@/server/auth";
import { PasswordForm } from "./PasswordForm";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t("Mot de passe") };
}
export const dynamic = "force-dynamic";

export default async function PasswordPage() {
  const user = await requireUser(undefined, { allowPasswordChange: true });
  const { t } = await getI18n();
  return (
    <main className="bg-dots flex min-h-dvh flex-col items-center px-4 py-8 sm:justify-center">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-between gap-3">
          <Brand size="sm" />
          <span className="flex-1" />
          <LangSwitch />
          {!user.mustChangePassword && (
            <Link href={ROLES[user.role].home} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900">
              <ArrowLeft className="size-4" /> {t("Retour")}
            </Link>
          )}
        </div>
        <div className="anim-rise rounded-3xl bg-white p-6 shadow-[0_20px_50px_-24px_rgba(15,23,42,0.25)] ring-1 ring-slate-900/5 sm:p-8">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 ring-1 ring-brand-600/10">
            <KeyRound className="size-5" />
          </span>
          <h1 className="mt-5 font-display text-2xl font-bold tracking-tight text-slate-900">{user.mustChangePassword ? t("Choisissez votre mot de passe") : t("Changer de mot de passe")}</h1>
          <p className="mt-1.5 text-[15px] text-slate-500">
            {user.mustChangePassword
              ? t("Votre compte a été créé avec un mot de passe provisoire. Remplacez-le pour continuer.")
              : (elides(user.firstName) ? t("Connecté en tant qu'{name}.", { name: `${user.firstName} ${user.lastName}` }) : t("Connecté en tant que {name}.", { name: `${user.firstName} ${user.lastName}` }))}
          </p>
          <PasswordForm />
        </div>
      </div>
    </main>
  );
}
