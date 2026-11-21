# Migration de la base vers Neon

CantineConnect utilise PostgreSQL via Prisma ; Neon est un PostgreSQL hébergé, donc **aucune modification du schéma ni des migrations n'est nécessaire**. Les migrations n'utilisent aucune extension et les verrous `SELECT … FOR UPDATE` des services (portefeuille, caisse) fonctionnent à travers le pooler de Neon, car chaque verrou vit dans une transaction Prisma.

## 1. Créer le projet Neon

1. Sur [console.neon.tech](https://console.neon.tech), créez un projet `cantine-connect` :
   - région **AWS Europe Central 1 (Frankfurt)**, alignée sur la région Vercel `fra1` de `vercel.json` ;
   - PostgreSQL **16 ou 17** (la base Docker locale est en 16 ; une copie 16 → 17 fonctionne).
2. Gardez la base par défaut (`neondb`) ou créez `cantine`.
3. Dans **Connect**, relevez deux chaînes :
   - **Pooled connection** (hôte en `-pooler`) → `DATABASE_URL`, utilisée par l'application ;
   - **Direct connection** (option *Connection pooling* désactivée) → `DIRECT_URL`, utilisée par les migrations et la copie.

## 2. Créer `.env.neon` sur votre poste

Ce fichier est ignoré par git (`.env.*`). Ne le partagez jamais : il contient le mot de passe de la base.

```dotenv
DATABASE_URL="postgresql://UTILISATEUR:MOT_DE_PASSE@ep-xxxx-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require&pgbouncer=true&connect_timeout=15"
DIRECT_URL="postgresql://UTILISATEUR:MOT_DE_PASSE@ep-xxxx.eu-central-1.aws.neon.tech/neondb?sslmode=require&connect_timeout=15"
```

- `pgbouncer=true` : obligatoire sur l'adresse poolée (Prisma désactive alors les requêtes préparées).
- `connect_timeout=15` : laisse le temps à Neon de réveiller la base après une mise en veille.
- Si Neon ajoute `&channel_binding=require` et que la connexion échoue, retirez ce paramètre.

Vérifiez la connexion :

```bash
npm run db:neon:check
```

## 3. Remplir la base : deux possibilités

**A. Base neuve** (recommandé pour la mise en production)

```bash
npm run db:neon:migrate
npm run db:neon:seed
```

Le seed crée l'administrateur à partir de `ADMIN_EMAIL` et `ADMIN_PASSWORD` (à ajouter dans `.env.neon` ou dans l'environnement).

**B. Copier la base locale** (pour garder les comptes, menus, soldes et le grand livre)

La base Neon doit être vide : le script refuse d'écraser des données. Il lance `pg_dump`/`pg_restore` dans le conteneur PostgreSQL local, puis compare le nombre de lignes des tables principales.

```bash
npm run db:neon:copy
```

Par défaut le conteneur s'appelle `cantine-db`. Avec `docker compose`, son nom est différent (`docker ps` pour le voir) :

```bash
SOURCE_CONTAINER=cantine-connect-v6-2026-11-21-db-1 npm run db:neon:copy
```

Les migrations Prisma déjà appliquées sont copiées avec les données : un `migrate deploy` ultérieur ne refera rien.

## 4. Brancher Vercel

1. **Project → Settings → Environment Variables**, pour l'environnement **Production** : `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, `APP_TIMEZONE`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` (et `VAPID_*` pour les notifications push).
2. Déployez. Le script `vercel-build` applique les migrations, crée l'administrateur s'il n'existe pas, puis construit l'application.
3. **Déploiements de prévisualisation** : `vercel-build` migre la base désignée par `DIRECT_URL`. Ne donnez donc pas l'adresse de production à l'environnement *Preview* ; utilisez une **branche Neon** dédiée (ou l'intégration Neon de Vercel, qui crée une branche par prévisualisation).

## 5. Après la bascule

- `npm run db:neon:check` doit afficher les quatre migrations et au moins un administrateur actif.
- Connectez-vous, faites une réservation et un passage en caisse : ce sont les opérations qui verrouillent le portefeuille.
- La première requête après une période calme peut prendre une à deux secondes (réveil de la base) ; l'application attend jusqu'à 10 s une connexion et 15 s par transaction (`src/server/db.ts`). Pour l'éviter le jour de la démonstration, désactivez la mise en veille dans **Compute → Scale to zero** (offre payante) ou ouvrez l'application quelques minutes avant.
- Sauvegardes : Neon garde un historique restaurable (*Restore*, durée selon l'offre). Avant une opération risquée, créez une branche Neon : c'est une copie instantanée.

## Tests

Les tests (`npm test`) restent sur une base PostgreSQL locale (`TEST_DATABASE_URL`) : ils vident les tables à chaque exécution. Ne pointez jamais `TEST_DATABASE_URL` vers la base Neon de production.
