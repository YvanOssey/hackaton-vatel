import { AppShell } from "@/components/shell/AppShell";
import { requireUser } from "@/server/auth";

export const dynamic = "force-dynamic";

export default async function KitchenLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser(["CHEF", "ADMIN"]);
  return (
    <AppShell
      user={user}
      nav={[
        { href: "/cuisine", label: "Production", icon: "kitchen" },
        { href: "/cuisine/menus", label: "Menus", icon: "dishes" },
        { href: "/cuisine/stock", label: "Stock", icon: "stock" },
      ]}
    >
      {children}
    </AppShell>
  );
}
