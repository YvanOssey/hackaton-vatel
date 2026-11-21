/**
 * Initialisation : paramètres par défaut et premier compte administrateur.
 * Idempotent. Une erreur de configuration n'interrompt pas le déploiement :
 * elle est expliquée dans le journal et sur la page de connexion.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/** Retire espaces et guillemets ajoutés par erreur autour d'une variable */
const clean = (v?: string) => v?.trim().replace(/^(["'])(.*)\1$/, "$2").trim() || undefined;

function problems(email?: string, password?: string) {
  const out: string[] = [];
  if (!email) out.push("ADMIN_EMAIL est vide");
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) out.push(`ADMIN_EMAIL n'est pas une adresse valide (${email})`);
  if (!password) out.push("ADMIN_PASSWORD est vide");
  else {
    if (password.length < 10) out.push(`ADMIN_PASSWORD fait ${password.length} caractères (10 minimum)`);
    if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) out.push("ADMIN_PASSWORD doit contenir des lettres et des chiffres");
  }
  return out;
}

async function main() {
  await prisma.settings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });

  if (await prisma.user.count({ where: { role: "ADMIN", status: "ACTIVE" } })) {
    console.log("[seed] Un administrateur existe déjà : rien à faire.");
    return;
  }

  const email = clean(process.env.ADMIN_EMAIL)?.toLowerCase();
  const password = clean(process.env.ADMIN_PASSWORD);
  const issues = problems(email, password);
  if (issues.length) {
    console.warn("\n[seed] ⚠ ADMINISTRATEUR NON CRÉÉ");
    for (const i of issues) console.warn(`[seed]   - ${i}`);
    console.warn("[seed]   Corrigez les variables d'environnement puis redéployez.\n");
    return;
  }

  await prisma.user.create({
    data: {
      email: email!,
      passwordHash: await bcrypt.hash(password!, 11),
      firstName: "Administrateur",
      lastName: "Principal",
      role: "ADMIN",
      status: "ACTIVE",
      tariffGroup: "STAFF",
      mustChangePassword: true,
    },
  });
  console.log(`[seed] Administrateur créé : ${email} (mot de passe à changer à la première connexion)`);
}

main()
  .catch((e) => {
    // Base injoignable ou autre erreur technique : là, on échoue franchement
    console.error("[seed] Échec :", e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
