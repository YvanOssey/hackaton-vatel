/**
 * Copie la base locale (conteneur Docker « cantine-db ») vers une base Neon vide : npm run db:neon:copy
 *
 * - La cible est DIRECT_URL, lue dans .env.neon (adresse directe, sans « -pooler » : pg_restore ne passe pas par PgBouncer).
 * - La base cible doit être vide : le script refuse d'écraser des données.
 * - pg_dump et pg_restore tournent dans le conteneur ; l'adresse Neon lui est transmise par variable d'environnement,
 *   jamais en clair dans la ligne de commande, et le mot de passe n'est jamais affiché.
 *
 * Variables facultatives : SOURCE_CONTAINER (cantine-db), SOURCE_DB (cantine), SOURCE_USER (cantine).
 */
import { spawnSync } from "node:child_process";

const container = process.env.SOURCE_CONTAINER || "cantine-db";
const sourceDb = process.env.SOURCE_DB || "cantine";
const sourceUser = process.env.SOURCE_USER || "cantine";
const TABLES = ["User", "Menu", "Reservation", "Transaction", "Notification"];

const mask = (url: string) => url.replace(/\/\/([^:@/]+):[^@]*@/, "//$1:••••@");
const fail = (msg: string): never => {
  console.error(`✘ ${msg}`);
  process.exit(1);
};

/** Garde seulement les paramètres compris par libpq (Prisma ajoute schema, pgbouncer… que psql refuse) */
function libpqUrl(raw: string) {
  const url = new URL(raw);
  const keep = new URLSearchParams();
  for (const [k, v] of url.searchParams) if (["sslmode", "channel_binding", "connect_timeout", "options"].includes(k)) keep.set(k, v);
  if (!keep.has("sslmode")) keep.set("sslmode", "require");
  url.search = keep.toString();
  return url.toString();
}

/** Lance une commande dans le conteneur ; TARGET y est transmis depuis l'environnement, pas en argument */
function inContainer(script: string, target?: string) {
  const args = ["exec", "-i", ...(target ? ["-e", "TARGET"] : []), container, "sh", "-c", script];
  const r = spawnSync("docker", args, { encoding: "utf8", env: { ...process.env, ...(target ? { TARGET: target } : {}) } });
  if (r.error) fail(`Docker introuvable : ${r.error.message}`);
  return { ok: r.status === 0, out: (r.stdout ?? "").trim(), err: (r.stderr ?? "").trim() };
}

const count = (where: "source" | "target", table: string, target?: string) => {
  const sql = `SELECT count(*) FROM "${table}"`;
  const r = where === "source" ? inContainer(`psql -U ${sourceUser} -d ${sourceDb} -Atc '${sql}'`) : inContainer(`psql "$TARGET" -Atc '${sql}'`, target);
  return r.ok ? Number(r.out) : NaN;
};

function main() {
  const raw = process.env.DIRECT_URL;
  if (!raw) fail("DIRECT_URL absente : créez .env.neon (voir docs/migration-neon.md).");
  if (raw!.includes("localhost") || raw!.includes("127.0.0.1")) fail("DIRECT_URL pointe vers la base locale : renseignez l'adresse Neon dans .env.neon.");
  if (raw!.includes("-pooler")) fail("DIRECT_URL doit être l'adresse directe de Neon (sans « -pooler »).");
  if (!raw!.includes("neon.tech") && !process.argv.includes("--any-host")) fail("DIRECT_URL ne pointe pas vers Neon (ajoutez --any-host pour un autre hébergeur).");
  const target = libpqUrl(raw!);
  console.log(`Source : conteneur ${container}, base ${sourceDb}`);
  console.log(`Cible  : ${mask(target)}`);

  const running = spawnSync("docker", ["inspect", "-f", "{{.State.Running}}", container], { encoding: "utf8" });
  if (running.stdout?.trim() !== "true") fail(`Le conteneur ${container} ne tourne pas : docker start ${container}`);

  const ping = inContainer(`psql "$TARGET" -Atc 'SELECT version()'`, target);
  if (!ping.ok) fail(`Connexion à Neon impossible : ${ping.err.split("\n").pop()}`);
  console.log(`✔ Neon joignable — ${ping.out.split(",")[0]}`);

  const tables = inContainer(`psql "$TARGET" -Atc "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'"`, target);
  if (!tables.ok) fail(tables.err);
  if (Number(tables.out) > 0) fail(`La base Neon contient déjà ${tables.out} table(s). Pour ne rien écraser, la copie ne se fait que vers une base vide (créez une nouvelle base ou une branche Neon).`);

  console.log("… Copie en cours (schéma, migrations Prisma et données)");
  const copy = inContainer(
    `set -o pipefail 2>/dev/null; pg_dump -U ${sourceUser} -d ${sourceDb} -Fc --no-owner --no-privileges | pg_restore --no-owner --no-privileges --exit-on-error -d "$TARGET"`,
    target,
  );
  if (!copy.ok) fail(`Copie interrompue : ${copy.err.split("\n").slice(-3).join(" ")}`);

  let identical = true;
  for (const t of TABLES) {
    const [a, b] = [count("source", t), count("target", t, target)];
    identical &&= a === b;
    console.log(`${a === b ? "✔" : "✘"} ${t.padEnd(13)} local ${a} · Neon ${b}`);
  }
  if (!identical) fail("Les comptes diffèrent : vérifiez la base Neon avant de l'utiliser.");
  console.log("✔ Copie terminée. Vérifiez avec : npm run db:neon:check");
}

main();
