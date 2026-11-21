import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource-variable/bricolage-grotesque";
import "./globals.css";
import { ToastProvider } from "@/components/toast";
import { I18nProvider } from "@/i18n/client";
import { getI18n } from "@/i18n/server";
import { env } from "@/server/env";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return {
    title: { default: "CantineConnect", template: "%s · CantineConnect" },
    applicationName: "CantineConnect",
    appleWebApp: { capable: true, title: "CantineConnect", statusBarStyle: "black-translucent" },
    icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
    description: t("La cantine sans file d’attente : menus de la semaine, réservation, portefeuille, suivi parental et pilotage de la cuisine."),
  };
}

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#ffffff" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale } = await getI18n();
  return (
    <html lang={locale}>
      <body className="min-h-screen font-sans">
        <I18nProvider locale={locale} timeZone={env.timezone}>
          <ToastProvider>{children}</ToastProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
