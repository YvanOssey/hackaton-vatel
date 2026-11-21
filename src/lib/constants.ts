import type { AccountStatus, Course, MobileProvider, NutriScore, PaymentMethod, Role, TariffGroup, TransactionType } from "@prisma/client";

export type AllergenId =
  | "gluten"
  | "crustaces"
  | "oeufs"
  | "poissons"
  | "arachides"
  | "soja"
  | "lait"
  | "fruits_a_coque"
  | "celeri"
  | "moutarde"
  | "sesame"
  | "sulfites"
  | "lupin"
  | "mollusques";

/** Les 14 allergènes à déclaration obligatoire */
export const ALLERGENS: Record<AllergenId, { label: string }> = {
  gluten: { label: "Gluten" },
  crustaces: { label: "Crustacés" },
  oeufs: { label: "Œufs" },
  poissons: { label: "Poissons" },
  arachides: { label: "Arachides" },
  soja: { label: "Soja" },
  lait: { label: "Lait" },
  fruits_a_coque: { label: "Fruits à coque" },
  celeri: { label: "Céleri" },
  moutarde: { label: "Moutarde" },
  sesame: { label: "Sésame" },
  sulfites: { label: "Sulfites" },
  lupin: { label: "Lupin" },
  mollusques: { label: "Mollusques" },
};
export const ALLERGEN_IDS = Object.keys(ALLERGENS) as AllergenId[];
export const isAllergen = (v: string): v is AllergenId => v in ALLERGENS;
export const allergenLabel = (v: string) => (isAllergen(v) ? ALLERGENS[v].label : v);

export const GROUPS: Record<TariffGroup, { label: string; tone: string }> = {
  STUDENT: { label: "Étudiant", tone: "bg-sky-50 text-sky-700 ring-sky-600/20" },
  SCHOLARSHIP: { label: "Boursier", tone: "bg-violet-50 text-violet-700 ring-violet-600/20" },
  STAFF: { label: "Personnel", tone: "bg-amber-50 text-amber-800 ring-amber-600/20" },
  EXTERNAL: { label: "Externe", tone: "bg-slate-100 text-slate-700 ring-slate-500/20" },
};
export const GROUP_IDS = Object.keys(GROUPS) as TariffGroup[];

export const ROLES: Record<Role, { label: string; home: string }> = {
  CONSUMER: { label: "Étudiant", home: "/espace" },
  PARENT: { label: "Parent", home: "/famille" },
  CASHIER: { label: "Caissier", home: "/caisse" },
  CHEF: { label: "Chef de cuisine", home: "/cuisine" },
  ADMIN: { label: "Administrateur", home: "/admin" },
};
export const STAFF_ROLES: Role[] = ["CASHIER", "CHEF", "ADMIN"];

export const STATUSES: Record<AccountStatus, { label: string; tone: "success" | "warning" | "danger" | "neutral" }> = {
  PENDING: { label: "En attente", tone: "warning" },
  ACTIVE: { label: "Actif", tone: "success" },
  REJECTED: { label: "Refusé", tone: "danger" },
  SUSPENDED: { label: "Suspendu", tone: "neutral" },
};

export const COURSES: Record<Course, string> = { STARTER: "Entrée", MAIN: "Plat", DESSERT: "Dessert" };
export const COURSE_ORDER: Course[] = ["STARTER", "MAIN", "DESSERT"];

export const METHODS: Record<PaymentMethod, string> = {
  CASH: "Espèces",
  WALLET: "Portefeuille",
  ADMIN: "Crédit administratif",
  MOBILE_MONEY: "Mobile Money",
};

export const MOBILE_PROVIDERS: Record<MobileProvider, { label: string; short: string; bg: string; fg: string }> = {
  WAVE: { label: "Wave", short: "W", bg: "#1dc8ff", fg: "#0b2a4a" },
  ORANGE_MONEY: { label: "Orange Money", short: "OM", bg: "#ff7900", fg: "#ffffff" },
};

/** Numéro mobile ivoirien : 10 chiffres commençant par 01, 05 ou 07 (indicatif +225 facultatif) */
export function normalizeCiPhone(raw: string) {
  const digits = raw.replace(/[\s.-]/g, "").replace(/^(\+|00)225/, "");
  return /^0[157]\d{8}$/.test(digits) ? digits : null;
}

export const TX_TYPES: Record<TransactionType, string> = {
  TOPUP: "Rechargement",
  MEAL: "Repas",
  ADJUSTMENT: "Ajustement",
};

export const NUTRI_COLORS: Record<NutriScore, string> = {
  A: "bg-emerald-600",
  B: "bg-lime-500",
  C: "bg-yellow-400",
  D: "bg-orange-500",
  E: "bg-red-600",
};

/** Rechargement en caisse (FCFA) */
export const TOPUP_MIN = 500;
export const TOPUP_MAX = 200_000;
export const CASH_TOPUP_PRESETS = [1_000, 2_000, 5_000, 10_000];
export const ONLINE_TOPUP_PRESETS = [2_000, 5_000, 10_000, 20_000];

export const RATING_LABELS = ["", "Décevant", "Moyen", "Bon", "Très bon", "Excellent"];
