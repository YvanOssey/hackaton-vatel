"use client";

import { useState, useTransition } from "react";
import type { Role } from "@prisma/client";
import { UserPlus } from "lucide-react";
import { createStaffAction } from "@/app/admin/actions";
import { useToast } from "@/components/toast";
import { Button, Card, CardHeader, Field, inputCls } from "@/components/ui";
import { ROLES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { OneTimePassword } from "./OneTimePassword";
import { useI18n } from "@/i18n/client";

export function StaffForm() {
  const toast = useToast();
  const { t } = useI18n();
  const [role, setRole] = useState<Role>("CASHIER");
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <Card>
      <CardHeader title={t("Ajouter un membre du personnel")} subtitle={t("Caissier, chef de cuisine ou administrateur")} icon={<UserPlus className="size-4" />} />
      <div className="p-5">
        {created ? (
          <OneTimePassword email={created.email} password={created.password} onDone={() => setCreated(null)} />
        ) : (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const form = e.currentTarget;
              start(async () => {
                const res = await createStaffAction({ email: String(fd.get("email")), firstName: String(fd.get("firstName")), lastName: String(fd.get("lastName")), role });
                if (res.ok) {
                  setCreated(res.data);
                  form.reset();
                } else toast({ tone: "error", title: t("Création refusée"), description: res.message });
              });
            }}
          >
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1">
              {(["CASHIER", "CHEF", "ADMIN"] as Role[]).map((r) => (
                <button key={r} type="button" onClick={() => setRole(r)} aria-pressed={role === r} className={cn("rounded-lg py-1.5 text-xs font-medium", role === r ? "bg-white text-slate-900 shadow-sm" : "text-slate-600")}>
                  {t(ROLES[r].label).split(" ")[0]}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("Prénom")} htmlFor="st-first">
                <input id="st-first" name="firstName" required autoComplete="off" className={inputCls} />
              </Field>
              <Field label={t("Nom")} htmlFor="st-last">
                <input id="st-last" name="lastName" required autoComplete="off" className={inputCls} />
              </Field>
            </div>
            <Field label={t("E-mail professionnel")} htmlFor="st-email">
              <input id="st-email" name="email" type="email" required autoComplete="off" spellCheck={false} autoCapitalize="none" placeholder="prenom.nom@exemple.com…" className={inputCls} />
            </Field>
            <Button type="submit" className="w-full" disabled={pending}>
              {t("Créer le compte")}
            </Button>
          </form>
        )}
      </div>
    </Card>
  );
}
