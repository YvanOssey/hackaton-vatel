"use client";

import { useState, useTransition } from "react";
import { updateProfileAction } from "@/app/espace/actions";
import { AllergenPicker } from "@/components/AllergenPicker";
import { useResultToast } from "@/components/toast";
import { Button, Field, inputCls } from "@/components/ui";
import { useI18n } from "@/i18n/client";

export function ProfileForm(props: { phone: string; allergens: string[] }) {
  const { t } = useI18n();
  const [phone, setPhone] = useState(props.phone);
  const [allergens, setAllergens] = useState(props.allergens);
  const [pending, start] = useTransition();
  const show = useResultToast();
  return (
    <form
      className="space-y-4 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => void show(await updateProfileAction({ phone, allergens }), "Profil enregistré"));
      }}
    >
      <Field label={t("Téléphone")} htmlFor="phone">
        <input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} />
      </Field>
      <div>
        <p className="mb-1.5 text-sm font-medium text-slate-700">{t("Allergies")}</p>
        <AllergenPicker value={allergens} onChange={setAllergens} />
      </div>
      <Button type="submit" disabled={pending}>
        {t("Enregistrer")}
      </Button>
    </form>
  );
}
