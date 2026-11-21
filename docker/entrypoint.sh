#!/bin/sh
# Démarrage du conteneur : migrations, compte administrateur, données de démo (facultatif), puis serveur.
set -e
echo "[cantine] Migrations de la base…"
npx prisma migrate deploy
echo "[cantine] Compte administrateur…"
npx tsx prisma/seed.ts
if [ "$DEMO_DATA" = "true" ]; then
  echo "[cantine] Données de démonstration…"
  npx tsx scripts/demo-seed.ts --force
fi
echo "[cantine] Application prête sur http://localhost:${PORT:-3000}"
exec npx next start -p "${PORT:-3000}" -H 0.0.0.0
