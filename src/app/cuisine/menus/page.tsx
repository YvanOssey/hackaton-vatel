import type { Metadata } from "next";
import { MenuEditor } from "@/components/cuisine/MenuEditor";
import { PageTitle } from "@/components/ui";
import { requireUser } from "@/server/auth";
import { kitchenOverview } from "@/server/services/queries";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t("Menus") };
}

export default async function MenusPage({ searchParams }: { searchParams: Promise<{ jour?: string }> }) {
  const { jour } = await searchParams;
  const k = await kitchenOverview(await requireUser(["CHEF", "ADMIN"]));
  const { t } = await getI18n();
  return (
    <>
      <PageTitle eyebrow={t("Cuisine")} title={t("Menus de la quinzaine")} />
      <MenuEditor initialDate={jour} today={k.today} dates={k.days.map((d) => d.date)} menus={k.menus} counts={Object.fromEntries(k.days.map((d) => [d.date, d.total]))} />
    </>
  );
}
