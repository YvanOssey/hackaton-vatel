import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    // Neon met la base en veille après quelques minutes d'inactivité : le réveil prend jusqu'à quelques secondes.
    // Les délais par défaut de Prisma (2 s pour obtenir une connexion, 5 s par transaction) feraient échouer
    // la première réservation ou le premier passage en caisse qui suit une période calme.
    transactionOptions: { maxWait: 10_000, timeout: 15_000 },
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export type Tx = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;
