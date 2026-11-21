import type { Metadata } from "next";
import { OpenSession } from "@/components/caisse/OpenSession";
import { PosScreen } from "@/components/caisse/PosScreen";
import { requireUser } from "@/server/auth";
import { env } from "@/server/env";
import { posState } from "@/server/services/queries";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t("Caisse") };
}

export default async function PosPage() {
  const user = await requireUser(["CASHIER", "ADMIN"]);
  const state = await posState(user);
  if (!state.session) return <OpenSession today={state.today} reservedCount={state.reservedCount} hasMenu={!!state.menu} />;
  return <PosScreen state={{ ...state, session: state.session, totals: state.totals! }} timezone={env.timezone} />;
}
