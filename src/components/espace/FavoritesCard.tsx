"use client";

import { useRef, useState, useTransition } from "react";
import { Heart, Plus, X } from "lucide-react";
import { addFavoriteAction, removeFavoriteAction } from "@/app/espace/actions";
import { useResultToast } from "@/components/toast";
import { Button, Card, CardHeader } from "@/components/ui";
import { MAX_FAVORITES } from "@/lib/dishes";
import { inputCls } from "@/lib/styles";
import { useI18n } from "@/i18n/client";

/** Plats préférés : une alerte arrive dès qu'un menu publié en contient un */
export function FavoritesCard({ favorites }: { favorites: { id: string; name: string }[] }) {
  const { t } = useI18n();
  const show = useResultToast();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const full = favorites.length >= MAX_FAVORITES;

  const add = () =>
    start(async () => {
      const res = await addFavoriteAction(name);
      if (res.ok) {
        show(res, "Plat préféré ajouté");
        setName("");
        setError(null);
      } else {
        setError(res.message);
        input.current?.focus();
      }
    });

  return (
    <Card className="anim-rise">
      <CardHeader title={t("Mes plats préférés")} subtitle={t("Vous recevez une alerte quand l'un d'eux est au menu.")} icon={<Heart className="size-4" />} />
      <div className="space-y-4 p-5">
        {favorites.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {favorites.map((f) => (
              <li key={f.id} className="inline-flex items-center gap-1 rounded-full bg-brand-50 py-1 pl-3 pr-1 text-sm font-medium text-brand-800 ring-1 ring-inset ring-brand-600/15">
                <Heart className="size-3.5 fill-brand-600 text-brand-600" aria-hidden />
                {f.name}
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => start(async () => void show(await removeFavoriteAction(f.id), "Plat retiré des préférés"))}
                  aria-label={t("Retirer {dish} de mes plats préférés", { dish: f.name })}
                  className="hit ml-0.5 rounded-full p-1 text-brand-700 hover:bg-brand-100 focus-visible:outline-2 focus-visible:outline-brand-600"
                >
                  <X className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">{t("Aucun plat préféré pour l'instant. Touchez le cœur d'un plat dans les menus, ou ajoutez-le ici.")}</p>
        )}
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <label className="min-w-0 flex-1">
            <span className="sr-only">{t("Nom du plat")}</span>
            <input
              ref={input}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              maxLength={120}
              disabled={full}
              placeholder={full ? t("Maximum atteint") : t("Ex. : Poulet yassa…")}
              aria-invalid={!!error}
              aria-describedby={error ? "favorite-error" : undefined}
              className={inputCls}
            />
          </label>
          <Button type="submit" variant="secondary" disabled={pending || full}>
            <Plus className="size-4" /> {t("Ajouter")}
          </Button>
        </form>
        {error && (
          <p id="favorite-error" className="-mt-2 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
      </div>
    </Card>
  );
}
