import type { Metadata } from "next";
import { MenuWeek } from "@/components/espace/MenuWeek";
import { TodayTicket } from "@/components/espace/TodayTicket";
import { LiveQueue } from "@/components/espace/LiveQueue";
import { liveService } from "@/server/services/live";
import { PageTitle } from "@/components/ui";
import { requireUser } from "@/server/auth";
import { consumerOverview } from "@/server/services/queries";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t("Menus") };
}

function greeting(minutes: number) {
  if (minutes < 11 * 60) return "Bonjour {name}";
  if (minutes < 18 * 60) return "Bon après-midi {name}";
  return "Bonsoir {name}";
}

export default async function ConsumerHome({ searchParams }: { searchParams: Promise<{ semaine?: string }> }) {
  const { semaine } = await searchParams;
  const [data, live] = await Promise.all([requireUser(["CONSUMER"]).then(consumerOverview), liveService()]);
  const { t } = await getI18n();
  const today = data.days.find((d) => d.date === data.today) ?? null;
  const nextDay = data.days.find((d) => d.date > data.today && d.menu && d.booking.open) ?? null;
  const canBook = data.user.status === "ACTIVE";
  return (
    <div className="space-y-8">
      <div>
        <PageTitle eyebrow={data.settings.establishmentName} title={t(greeting(data.nowMinutes), { name: data.user.firstName })} />
        <TodayTicket
          day={today}
          nextDay={nextDay}
          cutoff={data.settings.cutoffTime}
          nowMinutes={data.nowMinutes}
          price={data.price}
          balance={data.user.balance}
          available={data.available}
          lowThreshold={data.settings.lowBalanceThreshold}
          userAllergens={data.user.allergens}
          canBook={canBook}
        />
      </div>
      <LiveQueue initial={live} />
      <MenuWeek initialWeek={semaine === "prochaine" ? "next" : "current"} days={data.days} today={data.today} price={data.price} cutoff={data.settings.cutoffTime} userAllergens={data.user.allergens} canBook={canBook} favoriteKeys={data.favoriteKeys} />
    </div>
  );
}
