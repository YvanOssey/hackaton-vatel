"use client";

import { useState } from "react";
import { ImageOff } from "lucide-react";
import type { Course } from "@prisma/client";
import { Modal } from "@/components/ui";
import { COURSES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/client";

type PhotoDish = { course: Course; name: string; photo?: string | null };

/** Photo d'un plat : vignette (ou couverture) qui ouvre la photo en grand */
export function DishPhoto({ dish, className, imgClassName, children }: { dish: PhotoDish & { photo: string }; className?: string; imgClassName?: string; children?: React.ReactNode }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("Voir la photo : {name}", { name: dish.name })}
        className={cn("group relative block overflow-hidden bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600", className)}
      >
        <img src={dish.photo} alt="" loading="lazy" decoding="async" className={cn("size-full object-cover transition-transform duration-300 ease-[var(--ease-out-expo)] group-hover:scale-[1.03]", imgClassName)} />
        {children}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={`${t(COURSES[dish.course])} · ${dish.name}`}>
        <div className="p-4">
          <img src={dish.photo} alt={dish.name} className="w-full rounded-xl bg-slate-100 object-contain" />
        </div>
      </Modal>
    </>
  );
}

/** Galerie du menu du jour pour le personnel : une tuile par plat, avec ou sans photo */
export function MenuGallery({ dishes }: { dishes: PhotoDish[] }) {
  const { t } = useI18n();
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {dishes.map((d) => (
        <li key={d.course} className="overflow-hidden rounded-xl ring-1 ring-slate-900/[0.06]">
          {d.photo ? (
            <DishPhoto dish={{ ...d, photo: d.photo }} className="aspect-[4/3] w-full" />
          ) : (
            <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-1.5 bg-slate-50 text-slate-400">
              <ImageOff className="size-5" />
              <span className="text-xs">{t("Pas de photo")}</span>
            </div>
          )}
          <div className="px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">{t(COURSES[d.course])}</p>
            <p className="truncate text-sm font-medium text-slate-800">{d.name}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
