import type { Metadata } from "next";
import { StockManager } from "@/components/cuisine/StockManager";
import { PageTitle } from "@/components/ui";
import { requireUser } from "@/server/auth";
import { kitchenOverview } from "@/server/services/queries";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t("Stock") };
}

export default async function StockPage() {
  const k = await kitchenOverview(await requireUser(["CHEF", "ADMIN"]));
  const { t } = await getI18n();
  return (
    <>
      <PageTitle eyebrow={t("Cuisine")} title={t("Stock")} />
      <StockManager items={k.stock.map((s) => ({ id: s.id, name: s.name, unit: s.unit, qty: s.qty, minQty: s.minQty, perMeal: s.perMeal }))} />
    </>
  );
}
