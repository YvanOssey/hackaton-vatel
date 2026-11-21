/**
 * Vérifie la connexion à la base et son état : npm run db:check
 * N'affiche jamais le mot de passe de connexion.
 */
import { PrismaClient } from "@prisma/client";

const mask = (url?: string) => (url ? url.replace(/\/\/([^:@/]+):[^@]*@/, "//$1:••••@") : "(non définie)");

async function main() {
  console.log(`DATABASE_URL : ${mask(process.env.DATABASE_URL)}`);
  console.log(`DIRECT_URL   : ${mask(process.env.DIRECT_URL)}`);
  const pooled = process.env.DATABASE_URL ?? "";
  if (pooled.includes("neon.tech")) {
    if (!pooled.includes("-pooler")) console.warn("⚠ DATABASE_URL n'utilise pas l'hôte « -pooler » de Neon : recommandé sur Vercel.");
    if (!pooled.includes("pgbouncer=true")) console.warn("⚠ Ajoutez &pgbouncer=true à DATABASE_URL (connexion poolée Neon).");
    if (!pooled.includes("sslmode=require")) console.warn("⚠ Ajoutez ?sslmode=require (chiffrement obligatoire chez Neon).");
  }
  const prisma = new PrismaClient();
  try {
    const t0 = Date.now();
    const [{ version }] = await prisma.$queryRaw<{ version: string }[]>`SELECT version()`;
    console.log(`✔ Connexion OK en ${Date.now() - t0} ms — ${version.split(",")[0]}`);
    const tables = await prisma.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM information_schema.tables WHERE table_name = '_prisma_migrations'`;
    if (Number(tables[0].n) === 0) {
      console.log("✘ Tables absentes : lancez « npm run db:migrate » (fait automatiquement au déploiement Vercel).");
      return;
    }
    const migrations = await prisma.$queryRaw<{ migration_name: string }[]>`SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL ORDER BY finished_at`;
    console.log(`✔ Migrations appliquées : ${migrations.map((m) => m.migration_name).join(", ")}`);
    const admins = await prisma.user.count({ where: { role: "ADMIN", status: "ACTIVE" } });
    console.log(admins ? `✔ ${admins} administrateur(s) actif(s)` : "✘ Aucun administrateur : lancez « npm run db:seed » avec ADMIN_EMAIL et ADMIN_PASSWORD.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("✘ Connexion impossible :", e instanceof Error ? e.message.split("\n").slice(-2).join(" ") : e);
  process.exit(1);
});
