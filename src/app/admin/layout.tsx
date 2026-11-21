import { AppShell } from "@/components/shell/AppShell";
import { requireUser } from "@/server/auth";
import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser(["ADMIN"]);
  const pending = await prisma.user.count({ where: { status: "PENDING", role: "CONSUMER" } });
  return (
    <AppShell
      user={user}
      nav={[
        { href: "/admin", label: "Tableau de bord", icon: "dashboard" },
        { href: "/admin/comptes", label: "Comptes", icon: "users", badge: pending },
        { href: "/admin/caisses", label: "Sessions de caisse", icon: "cash" },
        { href: "/admin/finances", label: "Finances", icon: "finance" },
        { href: "/admin/parametres", label: "Paramètres", icon: "settings" },
        { href: "/admin/journal", label: "Journal d'audit", icon: "journal" },
      ]}
    >
      {children}
    </AppShell>
  );
}
