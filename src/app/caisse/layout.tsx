import { AppShell } from "@/components/shell/AppShell";
import { requireUser } from "@/server/auth";

export const dynamic = "force-dynamic";

export default async function PosLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser(["CASHIER", "ADMIN"]);
  return (
    <AppShell user={user} nav={[]} wide>
      {children}
    </AppShell>
  );
}
