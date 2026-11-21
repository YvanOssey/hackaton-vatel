"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Eye, EyeOff, ImagePlus, Leaf, LoaderCircle, Lock, Pencil, RefreshCw, Send, Trash2 } from "lucide-react";
import type { Course, MenuStatus, NutriScore } from "@prisma/client";
import { deleteMenuAction, removeDishPhotoAction, saveMenuAction, setPublishedAction, uploadDishPhotoAction } from "@/app/cuisine/actions";
import { DishPhoto } from "@/components/DishPhoto";
import { AllergenPicker } from "@/components/AllergenPicker";
import { useResultToast, useToast } from "@/components/toast";
import { Badge, Button, Card, CardHeader, ConfirmDialog, NutriBadge, inputCls } from "@/components/ui";
import { COURSES, NUTRI_COLORS } from "@/lib/constants";
import { ImageReadError, compressImage } from "@/lib/image";
import { photoKey } from "@/lib/photos";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/client";

type DishInput = { name: string; allergens: string[]; kcal: number; vegetarian: boolean };
type Menu = { id: string; date: string; status: MenuStatus; nutriScore: NutriScore; dishes: (DishInput & { course: Course })[] };
const KEYS = { STARTER: "starter", MAIN: "main", DESSERT: "dessert" } as const;
const empty = (): DishInput => ({ name: "", allergens: [], kcal: 0, vegetarian: false });
const PLACEHOLDERS: Record<Course, string> = { STARTER: "Ex. : Salade d'avocat…", MAIN: "Ex. : Poulet yassa, riz blanc…", DESSERT: "Ex. : Salade de fruits frais…" };

export function MenuEditor({ initialDate, today, dates, menus, counts, photos }: { initialDate?: string; today: string; dates: string[]; menus: Menu[]; counts: Record<string, number>; photos: Record<string, string> }) {
  const { t, day: formatDay } = useI18n();
  const editable = dates.filter((d) => d >= today);
  const [date, setDateState] = useState(initialDate && dates.includes(initialDate) ? initialDate : (editable.find((d) => !menus.some((m) => m.date === d)) ?? editable[0] ?? dates[0]));
  const [askLeave, setAskLeave] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Menu | null>(null);
  const baseline = useRef("");
  const [dishes, setDishes] = useState<Record<Course, DishInput>>({ STARTER: empty(), MAIN: empty(), DESSERT: empty() });
  const [nutri, setNutri] = useState<NutriScore>("B");
  const [pending, start] = useTransition();
  const show = useResultToast();
  const existing = menus.find((m) => m.date === date);
  const past = date < today;

  useEffect(() => {
    const m = menus.find((x) => x.date === date);
    const pick = (c: Course): DishInput => {
      const d = m?.dishes.find((x) => x.course === c);
      return d ? { name: d.name, allergens: [...d.allergens], kcal: d.kcal, vegetarian: d.vegetarian } : empty();
    };
    const next = { STARTER: pick("STARTER"), MAIN: pick("MAIN"), DESSERT: pick("DESSERT") };
    setDishes(next);
    setNutri(m?.nutriScore ?? "B");
    baseline.current = JSON.stringify([next, m?.nutriScore ?? "B"]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  // Modifications non enregistrées : avertissement avant de quitter la page ou de changer de jour
  const dirty = !past && baseline.current !== "" && JSON.stringify([dishes, nutri]) !== baseline.current;
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  /** Le jour choisi est dans l'URL (?jour=) : rechargement et partage gardent la sélection */
  const showDate = (d: string) => {
    setDateState(d);
    const url = new URL(window.location.href);
    url.searchParams.set("jour", d);
    window.history.replaceState(null, "", url);
  };
  const setDate = (d: string) => {
    if (d === date) return;
    if (dirty) setAskLeave(d);
    else showDate(d);
  };

  const update = (c: Course, patch: Partial<DishInput>) => setDishes((d) => ({ ...d, [c]: { ...d[c], ...patch } }));
  const submit = (publish: boolean) =>
    start(async () => {
      const ok = show(
        await saveMenuAction({ date, nutriScore: nutri, publish, starter: dishes.STARTER, main: dishes.MAIN, dessert: dishes.DESSERT }),
        publish ? "Menu publié" : "Brouillon enregistré",
      );
      if (ok) baseline.current = JSON.stringify([dishes, nutri]);
    });

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
      <Card>
        <CardHeader
          title={t(existing ? "Menu du {day}" : "Nouveau menu · {day}", { day: formatDay(date, { weekday: "long", day: "numeric", month: "long" }) })}
          subtitle={past ? t("Jour passé : consultation seule.") : t("Publiez le menu pour ouvrir les réservations.")}
          icon={<Pencil className="size-4" />}
          action={existing && <Badge tone={existing.status === "PUBLISHED" ? "success" : "warning"}>{existing.status === "PUBLISHED" ? t("Publié") : t("Brouillon")}</Badge>}
        />
        <div className="space-y-6 p-5">
          <div className="grid grid-cols-5 gap-2">
            {dates.map((d) => {
              const m = menus.find((x) => x.date === d);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDate(d)}
                  className={cn(
                    "relative rounded-xl px-1 py-2 text-center text-xs ring-1 ring-inset transition sm:text-sm",
                    d === date ? "bg-brand-950 text-white ring-brand-950" : "text-slate-700 ring-slate-200 hover:bg-slate-50",
                    d < today && d !== date && "opacity-50",
                  )}
                >
                  <span className="block font-semibold">{formatDay(d, { weekday: "short" })}</span>
                  <span className="block">{formatDay(d, { day: "numeric", month: "short" })}</span>
                  {m && <span className={cn("absolute right-1.5 top-1.5 size-1.5 rounded-full", m.status === "PUBLISHED" ? "bg-brand-500" : "bg-amber-400")} />}
                </button>
              );
            })}
          </div>

          <fieldset disabled={past || pending} className="space-y-5">
            {(Object.keys(KEYS) as Course[]).map((c) => (
              <div key={c} className="rounded-2xl border border-slate-200 p-4">
                <p className="mb-3 text-sm font-semibold text-slate-900">{t(COURSES[c])}</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_120px]">
                  <input aria-label={t("Nom — {course}", { course: t(COURSES[c]) })} value={dishes[c].name} onChange={(e) => update(c, { name: e.target.value })} placeholder={t(PLACEHOLDERS[c])} maxLength={120} className={inputCls} />
                  <label className="relative block">
                    <span className="sr-only">{t("Calories")}</span>
                    <input inputMode="numeric" value={dishes[c].kcal || ""} onChange={(e) => update(c, { kcal: Math.min(5000, Number(e.target.value.replace(/\D/g, "")) || 0) })} placeholder="0" className={inputCls + " pr-11 tabular-nums"} />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">kcal</span>
                  </label>
                </div>
                <div className="mt-3">
                  <AllergenPicker value={dishes[c].allergens} onChange={(v) => update(c, { allergens: v })} disabled={past} />
                </div>
                <PhotoField date={date} course={c} name={dishes[c].name} src={photos[photoKey(date, c)] ?? null} readOnly={past} />
                <label className="mt-2 inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm text-slate-600">
                  <input type="checkbox" checked={dishes[c].vegetarian} onChange={(e) => update(c, { vegetarian: e.target.checked })} className="size-4 rounded accent-brand-600" />
                  <Leaf className="size-4 text-brand-600" /> {t("Végétarien")}
                </label>
              </div>
            ))}
            <div>
              <p className="mb-2 text-sm font-medium text-slate-700">{t("Nutri-Score du menu")}</p>
              <div className="flex gap-2">
                {(Object.keys(NUTRI_COLORS) as NutriScore[]).map((n) => (
                  <button key={n} type="button" onClick={() => setNutri(n)} aria-pressed={nutri === n} className={cn("size-11 rounded-xl text-sm font-bold text-white transition", NUTRI_COLORS[n], nutri === n ? "scale-110 ring-2 ring-slate-900 ring-offset-2" : "opacity-40 hover:opacity-70")}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
            {!past && (
              <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
                {(!existing || existing.status === "DRAFT") && (
                  <Button variant="secondary" onClick={() => submit(false)}>
                    {t("Enregistrer le brouillon")}
                  </Button>
                )}
                <Button onClick={() => submit(true)}>
                  <Send className="size-4" /> {existing?.status === "PUBLISHED" ? t("Mettre à jour le menu publié") : t("Publier le menu")}
                </Button>
              </div>
            )}
          </fieldset>
        </div>
      </Card>

      <Card className="self-start">
        <CardHeader title={t("Planning")} subtitle={t("Semaine en cours et suivante")} />
        <ul className="divide-y divide-slate-100">
          {dates.map((d) => {
            const m = menus.find((x) => x.date === d);
            const locked = d < today;
            return (
              <li key={d} className={cn("px-5 py-3", d === date && "bg-slate-50")}>
                <div className="flex items-center justify-between gap-2">
                  <button onClick={() => setDate(d)} className="hit text-left text-sm font-semibold text-slate-900 hover:text-brand-700">
                    {formatDay(d, { weekday: "long", day: "numeric", month: "short" })}
                  </button>
                  {m ? <Badge tone={m.status === "PUBLISHED" ? "success" : "warning"}>{m.status === "PUBLISHED" ? t("Publié") : t("Brouillon")}</Badge> : <Badge>{locked ? t("Aucun") : t("À créer")}</Badge>}
                </div>
                {m && (
                  <div className="mt-1 flex items-center gap-1">
                    <p className="min-w-0 flex-1 truncate text-sm text-slate-500">
                      {m.dishes.find((x) => x.course === "MAIN")?.name} · {t("{count} réservé(s)", { count: counts[d] ?? 0 })}
                    </p>
                    <NutriBadge score={m.nutriScore} />
                    {locked ? (
                      <Lock className="ml-1 size-4 text-slate-300" aria-label={t("Verrouillé")} />
                    ) : (
                      <>
                        {m.status === "PUBLISHED" ? (
                          <button disabled={pending} onClick={() => start(async () => void show(await setPublishedAction(m.id, false), "Menu dépublié"))} className="flex size-11 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100" title={t("Repasser en brouillon")} aria-label={t("Repasser en brouillon")}>
                            <EyeOff className="size-4" />
                          </button>
                        ) : (
                          <button disabled={pending} onClick={() => start(async () => void show(await setPublishedAction(m.id, true), "Menu publié"))} className="flex size-11 items-center justify-center rounded-lg text-brand-700 hover:bg-brand-50" title={t("Publier")} aria-label={t("Publier")}>
                            <Eye className="size-4" />
                          </button>
                        )}
                        <button disabled={pending} onClick={() => setToDelete(m)} className="flex size-11 items-center justify-center rounded-lg text-red-600 hover:bg-red-50" title={t("Supprimer")} aria-label={t("Supprimer")}>
                          <Trash2 className="size-4" />
                        </button>
                      </>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
      <ConfirmDialog
        open={!!askLeave}
        onClose={() => setAskLeave(null)}
        onConfirm={() => {
          showDate(askLeave!);
          setAskLeave(null);
        }}
        title={t("Abandonner les modifications ?")}
        confirmLabel={t("Abandonner")}
      >
        {t("Le menu en cours de saisie n'est pas enregistré. Changer de jour efface ces modifications.")}
      </ConfirmDialog>
      <ConfirmDialog
        open={!!toDelete}
        pending={pending}
        onClose={() => setToDelete(null)}
        onConfirm={() =>
          start(async () => {
            if (show(await deleteMenuAction(toDelete!.id), "Menu supprimé")) setToDelete(null);
          })
        }
        title={t("Supprimer ce menu ?")}
        confirmLabel={t("Supprimer le menu")}
      >
        {toDelete && t("Le menu du {day} sera définitivement supprimé. Les étudiants ne le verront plus.", { day: formatDay(toDelete.date, { weekday: "long", day: "numeric", month: "long" }) })}
      </ConfirmDialog>
    </div>
  );
}

/**
 * Photo d'un plat : envoyée dès qu'elle est choisie (indépendamment de l'enregistrement du menu),
 * après compression dans le navigateur. Rattachée au jour et au plat.
 */
function PhotoField({ date, course, name, src, readOnly }: { date: string; course: Course; name: string; src: string | null; readOnly: boolean }) {
  const { t } = useI18n();
  const toast = useToast();
  const show = useResultToast();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  const label = t("Photo — {course}", { course: t(COURSES[course]) });

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const blob = await compressImage(file);
      const form = new FormData();
      form.set("date", date);
      form.set("course", course);
      form.set("photo", blob, "photo");
      show(await uploadDishPhotoAction(form), "Photo ajoutée");
    } catch (e) {
      const tooLarge = e instanceof ImageReadError && e.message === "too-large";
      toast({ tone: "error", title: t("Photo non envoyée"), description: t(tooLarge ? "Photo trop lourde (1,5 Mo au plus) : choisissez une image plus petite." : "Format non pris en charge : utilisez une photo JPEG, PNG ou WebP.") });
    } finally {
      setBusy(false);
    }
  };

  const picker = (text: string, icon: React.ReactNode, cls: string) => (
    <label className={cn("hit relative inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-3 text-sm font-semibold transition focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand-600", busy && "pointer-events-none opacity-60", cls)}>
      {busy ? <LoaderCircle className="size-4 animate-spin" /> : icon}
      {busy ? t("Envoi…") : text}
      <input
        type="file"
        accept="image/*"
        aria-label={label}
        className="sr-only"
        disabled={busy}
        onChange={(e) => {
          void upload(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </label>
  );

  if (readOnly && !src) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-3">
      {src ? (
        <DishPhoto dish={{ course, name: name || t(COURSES[course]), photo: src }} className="h-20 w-28 shrink-0 rounded-xl ring-1 ring-slate-900/[0.06]" />
      ) : null}
      {!readOnly &&
        (src ? (
          <div className="flex flex-wrap gap-1">
            {picker(t("Remplacer"), <RefreshCw className="size-4" />, "text-slate-700 ring-1 ring-inset ring-slate-200 hover:bg-slate-50")}
            <button type="button" disabled={busy || pending} onClick={() => setConfirm(true)} className="hit inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-red-600 hover:bg-red-50">
              <Trash2 className="size-4" /> {t("Retirer")}
            </button>
          </div>
        ) : (
          <div>
            {picker(t("Ajouter une photo"), <ImagePlus className="size-4" />, "border border-dashed border-slate-300 text-slate-700 hover:border-brand-500 hover:bg-brand-50 hover:text-brand-700")}
            <p className="mt-1 text-xs text-slate-500">{t("JPEG, PNG ou WebP · réduite automatiquement avant l'envoi")}</p>
          </div>
        ))}
      <ConfirmDialog
        open={confirm}
        pending={pending}
        onClose={() => setConfirm(false)}
        onConfirm={() =>
          start(async () => {
            if (show(await removeDishPhotoAction(date, course), "Photo retirée")) setConfirm(false);
          })
        }
        title={t("Retirer cette photo ?")}
        confirmLabel={t("Retirer la photo")}
      >
        {t("Les étudiants ne verront plus la photo de ce plat.")}
      </ConfirmDialog>
    </div>
  );
}
