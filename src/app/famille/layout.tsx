import { AppShell } from "@/components/shell/AppShell";
import { requireUser } from "@/server/auth";

export const dynamic = "force-dynamic";

export default async function FamilyLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser(["PARENT"]);
  return (
    <AppShell
      user={user}
      nav={[
        { href: "/famille", label: "Suivi des repas", short: "Suivi", icon: "family" },
        { href: "/famille/associer", label: "Associer un enfant", short: "Associer", icon: "users" },
      ]}
    >
      {children}
    </AppShell>
  );
}
