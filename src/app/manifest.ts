import type { MetadataRoute } from "next";
import { getI18n } from "@/i18n/server";

/** Application installable (écran d'accueil) : nécessaire aux notifications push sur iPhone */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const { t, locale } = await getI18n();
  return {
    name: "CantineConnect",
    short_name: "Cantine",
    description: t("La cantine sans file d’attente : menus de la semaine, réservation, portefeuille, suivi parental et pilotage de la cuisine."),
    lang: locale,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#1d1d1b",
    theme_color: "#1d1d1b",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
