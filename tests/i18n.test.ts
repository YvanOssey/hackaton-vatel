import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { pickLocale } from "@/i18n/config";
import { createI18n, translate } from "@/i18n/core";
import { en } from "@/i18n/en";
import { ALLERGENS, COURSES, GROUPS, METHODS, RATING_LABELS, ROLES, STATUSES, TX_TYPES } from "@/lib/constants";
import { elides } from "@/lib/utils";

const SRC = path.resolve(__dirname, "../src");
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(f) && !p.includes(`${path.sep}i18n${path.sep}`) ? [p] : [];
  });

/** Textes sources repérés dans le code : appels t("…"), erreurs métier, messages de validation, libellés */
function sourceKeys() {
  const keys = new Map<string, string>();
  const patterns = [
    /\bt\(\s*"((?:[^"\\]|\\.)+)"/g,
    /new AppError\(\s*"((?:[^"\\]|\\.)+)"/g,
    /\.(?:min|max|regex|refine|length|email|int|positive|nonnegative|superRefine)\([^"\n]*?"((?:[^"\\]|\\.)+)"\s*\)/g,
    /\b(?:message|title|body|reason|label|short|text):\s*"((?:[^"\\]|\\.)+)"/g,
    /,\s*"([A-ZÀ-Ý][^"\n]*[a-zà-ÿ.!][^"\n]*)"\s*,?\s*\)/g,
  ];
  for (const file of files(SRC)) {
    const src = readFileSync(file, "utf8");
    for (const re of patterns) for (const m of src.matchAll(re)) keys.set(JSON.parse(`"${m[1]}"`), path.relative(SRC, file));
  }
  return keys;
}

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)(?::\w+)?\}/g)].map((m) => m[1]).sort();

describe("traduction anglaise", () => {
  it("couvre chaque texte source de l'interface et des messages serveur", () => {
    const ignored = new Set(["use client", "use server", "CantineConnect"]);
    const missing = [...sourceKeys()].filter(([k]) => !ignored.has(k) && /[a-zà-ÿ]/.test(k) && !/^[a-z0-9:\-[\]/.%]+$/.test(k) && !(k in en)).map(([k, f]) => `${f} → ${k}`);
    expect(missing).toEqual([]);
  });

  it("couvre les libellés métier (allergènes, rôles, statuts, modes de paiement…)", () => {
    const labels = [
      ...Object.values(ALLERGENS).map((a) => a.label),
      ...Object.values(GROUPS).map((g) => g.label),
      ...Object.values(ROLES).map((r) => r.label),
      ...Object.values(STATUSES).map((s) => s.label),
      ...Object.values(COURSES),
      ...Object.values(METHODS),
      ...Object.values(TX_TYPES),
      ...RATING_LABELS.filter(Boolean),
    ];
    expect(labels.filter((l) => !(l in en))).toEqual([]);
  });

  it("garde les mêmes paramètres d'interpolation dans les deux langues", () => {
    const broken = Object.entries(en).filter(([fr, eng]) => placeholders(fr).join() !== placeholders(eng).join());
    expect(broken).toEqual([]);
  });

  it("interpole montants, nombres et textes selon la langue", () => {
    expect(translate("fr", "Nouveau solde : {balance:money}", { balance: 12500 })).toBe("Nouveau solde : 12 500 FCFA");
    expect(translate("en", "Nouveau solde : {balance:money}", { balance: 12500 })).toBe("New balance: 12,500 FCFA");
    expect(translate("en", "Bienvenue {name}", { name: "Aya" })).toBe("Welcome Aya");
    expect(translate("en", "Texte sans traduction")).toBe("Texte sans traduction");
    expect(createI18n("en").money(-500)).toBe("−500 FCFA");
    expect(createI18n("en").day("2026-11-18")).toBe("Wednesday 18 November");
    expect(createI18n("fr").dayInline("2026-11-18")).toBe("mercredi 18 novembre");
  });

  it("traduit les notes générées par l'application", () => {
    const { note } = createI18n("en");
    expect(note("Payé par Marie Kouassi · Réf. MM-123")).toBe("Paid by Marie Kouassi · Ref. MM-123");
    expect(note("Alerte allergène vérifiée : arachides, lait")).toBe("Allergen alert checked: Peanuts, Milk");
    expect(note("Remboursement manuel")).toBe("Remboursement manuel");
  });

  it("élide « de » et « que » devant un prénom à voyelle ou h muet, dans les deux langues", () => {
    expect([elides("Aya"), elides("Inès"), elides("Hélène"), elides("Émile"), elides("Marie"), elides("Koffi")]).toEqual([true, true, true, true, false, false]);
    expect(translate("fr", "Portefeuille d'{child} rechargé", { child: "Aya" })).toBe("Portefeuille d'Aya rechargé");
    expect(translate("en", "Portefeuille d'{child} rechargé", { child: "Aya" })).toBe("Aya's wallet topped up");
    expect(translate("en", "Les repas d'{name}", { name: "Aya" })).toBe(translate("en", "Les repas de {name}", { name: "Aya" }));
  });

  it("choisit la langue : cookie, puis navigateur, puis français", () => {
    expect(pickLocale("en", "fr-FR")).toBe("en");
    expect(pickLocale(undefined, "en-US,en;q=0.9")).toBe("en");
    expect(pickLocale(undefined, "de-DE,es;q=0.8")).toBe("fr");
    expect(pickLocale("xx", undefined)).toBe("fr");
  });
});
