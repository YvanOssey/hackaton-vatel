import type { Metadata } from "next";
import { SettingsForm } from "@/components/admin/SettingsForm";
import { PageTitle } from "@/components/ui";
import { requireUser } from "@/server/auth";
import { adminSettings } from "@/server/services/queries";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t("Paramètres") };
}

export default async function SettingsPage() {
  const values = await adminSettings(await requireUser(["ADMIN"]));
  const { t } = await getI18n();
  return (
    <>
      <PageTitle eyebrow={t("Administration")} title={t("Paramètres")} />
      <SettingsForm initial={values} />
    </>
  );
}
