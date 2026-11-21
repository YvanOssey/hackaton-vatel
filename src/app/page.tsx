import type { Viewport } from "next";
import { ROLES } from "@/lib/constants";
import { getI18n } from "@/i18n/server";
import { getCurrentUser } from "@/server/auth";
import { prisma } from "@/server/db";
import { clock } from "@/server/time";
import { publicMenuPreview } from "@/server/services/queries";
import { Landing } from "./Landing";
import { Splash } from "./Splash";

/** Barre du navigateur mobile assortie à l'en-tête vert profond */
export const viewport: Viewport = { themeColor: "#1d1d1b" };

export const dynamic = "force-dynamic";

export default async function Home() {
  const [user, settings, { day, t }] = await Promise.all([getCurrentUser(), prisma.settings.findUnique({ where: { id: 1 }, select: { establishmentName: true } }), getI18n()]);
  if (!user) return <Landing data={await publicMenuPreview()} i18n={await getI18n()} />;
  const target = !user ? "/connexion" : user.mustChangePassword ? "/mot-de-passe" : ROLES[user.role].home;
  return <Splash target={target} dateLabel={day(clock().today)} establishment={settings?.establishmentName ?? t("Restaurant universitaire")} />;
}
