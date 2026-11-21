import type { Viewport } from "next";
import { ROLES } from "@/lib/constants";
import { getI18n } from "@/i18n/server";
import { getCurrentUser } from "@/server/auth";
import { prisma } from "@/server/db";
import { clock } from "@/server/time";
import { Splash } from "./Splash";

/** Barre du navigateur mobile assortie à l'en-tête vert profond */
export const viewport: Viewport = { themeColor: "#022c22" };

export const dynamic = "force-dynamic";

export default async function Home() {
  const [user, settings, { day, t }] = await Promise.all([getCurrentUser(), prisma.settings.findUnique({ where: { id: 1 }, select: { establishmentName: true } }), getI18n()]);
  const target = !user ? "/connexion" : user.mustChangePassword ? "/mot-de-passe" : ROLES[user.role].home;
  return <Splash target={target} dateLabel={day(clock().today)} establishment={settings?.establishmentName ?? t("Restaurant universitaire")} />;
}
