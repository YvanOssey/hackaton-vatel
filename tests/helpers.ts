import { vi } from "vitest";
import type { Role, TariffGroup } from "@prisma/client";
import { prisma } from "@/server/db";
import type { Actor } from "@/server/services/common";
import { isoToDate } from "@/lib/utils";

/** Mardi 17 novembre 2026 (Abidjan = UTC) */
export const TODAY = "2026-11-17";
export const TOMORROW = "2026-11-18";

export function setTime(hhmm: string, day = TODAY) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(`${day}T${hhmm}:00Z`));
}

export async function resetDb() {
  await prisma.$executeRawUnsafe(
    `TRUNCATE "FavoriteDish","MenuPhoto","Notification","Rating","PaymentIntent","LinkCode","ParentLink","AuditLog","Transaction","Reservation","CashSession","Dish","Menu","Session","LoginAttempt","StockItem","Settings","User" RESTART IDENTITY CASCADE`,
  );
  await prisma.settings.create({ data: { id: 1 } });
}

let n = 0;
export async function makeUser(opts: { role?: Role; status?: "ACTIVE" | "PENDING"; balance?: number; group?: TariffGroup; allergens?: string[] } = {}): Promise<Actor> {
  n += 1;
  return prisma.user.create({
    data: {
      email: `user${n}@test.local`,
      passwordHash: "x",
      firstName: "Prénom",
      lastName: `Nom${n}`,
      role: opts.role ?? "CONSUMER",
      status: opts.status ?? "ACTIVE",
      balance: opts.balance ?? 0,
      tariffGroup: opts.group ?? "STUDENT",
      allergens: opts.allergens ?? [],
    },
  });
}

export async function makeMenu(date: string, opts: { published?: boolean; allergens?: string[] } = {}) {
  return prisma.menu.create({
    data: {
      date: isoToDate(date),
      status: opts.published === false ? "DRAFT" : "PUBLISHED",
      dishes: {
        create: [
          { course: "STARTER", name: "Salade", allergens: [] },
          { course: "MAIN", name: "Poulet yassa", allergens: opts.allergens ?? [] },
          { course: "DESSERT", name: "Fruit", allergens: [] },
        ],
      },
    },
  });
}

export const balanceOf = async (id: string) => (await prisma.user.findUniqueOrThrow({ where: { id } })).balance;
