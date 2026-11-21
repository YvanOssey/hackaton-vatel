# CantineConnect — V1

Application de gestion d'un restaurant universitaire : menus de la semaine, réservation, portefeuille prépayé en FCFA rechargeable par Mobile Money, pass QR, suivi parental, caisse avec clôture, cuisine (prévision anti-gaspillage, commandes du jour, avis) et administration. L'ouverture passe par un écran d'accueil animé, puis par une connexion ou une inscription guidée (étudiant ou parent).

**Stack** : Next.js 15 (App Router, Server Actions) · TypeScript · Tailwind CSS 4 · PostgreSQL 16 · Prisma 6.

## Rôles et accès

Chaque page et chaque action est vérifiée côté serveur. L'interface ne fait qu'afficher ce que le serveur autorise.

| Rôle | Espace | Peut faire |
| --- | --- | --- |
| **Étudiant** | `/espace` | S'inscrire, consulter les menus, réserver et annuler, recharger par Mobile Money, voir son solde et son historique, afficher son pass QR, déclarer ses allergies, noter ses repas, autoriser un parent |
| **Parent** | `/famille` | S'inscrire, associer son enfant avec le code qu'il lui donne, suivre son solde, ses réservations et ce qu'il a mangé, recharger son portefeuille, recevoir les alertes |
| **Caissier** | `/caisse` | Ouvrir et clôturer sa caisse, identifier un usager (douchette, recherche), valider un repas, encaisser un rechargement en espèces |
| **Chef de cuisine** | `/cuisine` | Voir la prévision de production, les commandes du jour et les allergies du service, créer et publier les menus, gérer le stock, lire les avis |
| **Administrateur** | `/admin` (et caisse, cuisine) | Valider les inscriptions, créer le personnel, créditer ou corriger un portefeuille, suspendre un compte, régler les tarifs et les règles, consulter les sessions de caisse, le grand livre (export CSV) et le journal d'audit |

## Règles de gestion

**Comptes**
- **Inscription :** l'étudiant s'inscrit avec son numéro étudiant, qui doit être unique. Son compte reste *en attente* : il ne peut ni réserver ni être servi avant que l'administration ait vérifié ce numéro. Il peut déjà recharger son portefeuille au comptoir.
- **Tarif :** un seul prix de repas, réglable par l'administrateur.
- **Personnel :** seul l'administrateur crée les comptes du personnel. Il reçoit un mot de passe provisoire, à changer obligatoirement à la première connexion.
- **Garde-fous :** l'administrateur ne peut pas suspendre son propre compte, ni suspendre le dernier administrateur actif.

**Réservations**
- **Conditions :** un menu publié, une date ni passée ni au-delà de l'horizon (14 jours par défaut), et une réservation pour le jour même avant l'heure limite (10:00 par défaut).
- **Paiement :** la réservation *engage* le prix sans le débiter. Elle est refusée si le solde disponible (solde moins réservations à venir) est insuffisant. Le tarif est figé au moment de la réservation.
- **Annulation :** possible jusqu'à l'heure limite. Elle libère le montant engagé.

**Parents**
- **Association :** l'étudiant génère un code de 8 caractères (usage unique, valable 48 h, seule son empreinte est stockée) et le transmet. Le parent le saisit pour voir son enfant. Cinq codes erronés bloquent la saisie 15 minutes.
- **Cloisonnement :** un parent ne voit et ne recharge que les étudiants qui l'ont associé (quatre parents au plus par étudiant). L'étudiant comme le parent peuvent rompre le lien.

**Rechargement Mobile Money (Wave, Orange Money)**
- **Deux temps :** la demande est envoyée sur le téléphone du payeur, puis l'opérateur confirme. Le portefeuille n'est crédité qu'après confirmation, une seule fois, même si la confirmation est rejouée (passage atomique de la demande à « réussie » dans la transaction qui écrit le grand livre).
- **Échecs :** un refus de l'opérateur ou une demande non confirmée en 15 minutes ne crédite rien.
- **Mode test :** la passerelle est simulée (`src/server/payments/provider.ts`). Un numéro finissant par 0000 simule un refus. Brancher l'API réelle de Wave ou d'Orange Money revient à implémenter l'interface `PaymentGateway`.

**Notifications**
- Validation du compte, association d'un parent, rechargement par un parent, repas servi (au parent), solde passé sous le seuil (à l'étudiant et à ses parents). Elles sont écrites dans la même transaction que l'événement.

**Avis et prévision**
- **Notes :** un repas servi se note de 1 à 5, avec un commentaire facultatif, pendant 7 jours. La cuisine voit la moyenne sur 30 jours, la répartition, les menus préférés et les derniers commentaires.
- **Anti-gaspillage :** la production prévue = réservations + moyenne des passages sans réservation des 4 mêmes jours de semaine précédents (jours servis uniquement).

**Caisse**
- **Session :** aucune opération n'est possible sans une session de caisse ouverte avec son fond de caisse. Un caissier ne peut avoir qu'une session ouverte à la fois.
- **Validation d'un repas :** le portefeuille est débité du tarif figé. Un deuxième passage le même jour est refusé, même si deux caisses valident au même instant. Le solde ne peut jamais devenir négatif (contrainte vérifiée aussi par la base de données).
- **Allergènes :** si le menu du jour contient un allergène déclaré par l'usager, la validation est bloquée jusqu'à ce que l'agent confirme avoir remis un plateau adapté. Cette confirmation est tracée.
- **Sans réservation :** l'usager est servi au tarif normal, signalé en orange. L'administration peut désactiver cette possibilité.
- **Pass QR :** le QR Code est signé (HMAC-SHA256). Un code modifié ou inventé est refusé. L'usager peut révoquer son pass (téléphone perdu) ; l'ancien code est alors refusé.
- **Clôture :** le caissier compte ses espèces. L'attendu vaut le fond de caisse plus les espèces encaissées. Tout écart doit être justifié, puis la session est verrouillée.

**Menus**
- Un jour passé ne se modifie plus.
- Un menu déjà réservé ne peut être ni dépublié ni supprimé.

**Traçabilité**
- **Grand livre :** chaque mouvement d'argent est une écriture du grand livre, avec le solde après opération et l'opérateur. Aucune écriture n'est jamais modifiée ni supprimée.
- **Journal d'audit :** les actions sensibles y sont enregistrées (validations, ajustements, paramètres, menus, caisse).

**Langues (FR / EN)**
- L'application est entièrement bilingue : interface, messages d'erreur, notifications, notes d'opération et export CSV.
- La langue se choisit avec le sélecteur FR / EN (écrans d'accès, en-tête, menu du compte) et reste mémorisée dans un cookie. Sans choix explicite, la langue du navigateur est utilisée, sinon le français.
- Le français est la langue source : chaque clé de `src/i18n/en.ts` est le texte français affiché, avec des paramètres (`{name}`, `{amount:money}`). Montants, dates et heures suivent les conventions de la langue (« 1 500 FCFA » / « 1,500 FCFA »).
- Les notifications sont enregistrées avec leurs paramètres et traduites à l'affichage : un parent anglophone lit « Aya had lunch » même si l'événement a eu lieu quand il était en français.
- Le contenu saisi par l'équipe (noms des plats, motifs, commentaires) reste dans la langue où il a été écrit.

**Notifications push**
- Chaque utilisateur active les notifications par appareil (profil étudiant, page de suivi parent, ou menu du compte). Il peut envoyer un test.
- Elles reprennent les notifications de la cloche : repas servi et solde bas (parent), rechargement, validation du compte, association.
- Envoi par Web Push (clés VAPID, bibliothèque `web-push`), après la réponse et hors transaction : chaque notification est réservée avant envoi, donc jamais envoyée deux fois. Celles de plus d'une heure ne partent plus en push.
- Le texte est envoyé dans la langue de l'utilisateur. Les abonnements expirés (appareil désinstallé, permission retirée) sont supprimés.
- Seuls les services de push des navigateurs sont acceptés comme destination (Google, Mozilla, Apple, Microsoft).
- L'application est installable (manifeste et icônes) : sur iPhone, les notifications fonctionnent une fois CantineConnect ajouté à l'écran d'accueil.
- Sans clés VAPID dans `.env`, le push est désactivé et les notifications restent dans la cloche.

## Sécurité

- **Mots de passe :** hachés avec bcrypt. 10 caractères minimum, avec des lettres et des chiffres.
- **Connexion :** cinq échecs bloquent la connexion pendant 15 minutes. La réponse prend le même temps, que l'adresse e-mail existe ou non.
- **Sessions :** stockées en base. Le cookie est `httpOnly`, `SameSite=Lax` et `Secure` en production. Seule l'empreinte SHA-256 du jeton est stockée.
- **Contrôles :** rôles et données validés côté serveur (zod) dans chaque action.
- **En-têtes HTTP :** CSP, HSTS, `X-Frame-Options: DENY`, `nosniff`.
- **Export CSV :** les cellules sont protégées contre l'injection de formules.

## Installation locale

Prérequis : Node.js 20 ou plus, PostgreSQL 14 ou plus.

1. Installer les dépendances :

   ```bash
   npm install
   ```

2. Créer à la racine un fichier `.env` (ignoré par git) avec le contenu ci-dessous, puis le compléter. En local, `DATABASE_URL` et `DIRECT_URL` sont identiques ; avec Neon, voir [docs/migration-neon.md](docs/migration-neon.md). Le `AUTH_SECRET` (32 caractères minimum) se génère avec `openssl rand -base64 48`.

   ```dotenv
   # Base PostgreSQL
   DATABASE_URL="postgresql://cantine:cantine@localhost:5432/cantine?schema=public"
   DIRECT_URL="postgresql://cantine:cantine@localhost:5432/cantine?schema=public"

   # Secret de signature des QR Codes (obligatoire en production)
   AUTH_SECRET=""

   # Fuseau horaire de l'établissement (heure limite, journée de service)
   APP_TIMEZONE="Africa/Abidjan"

   # Premier administrateur créé par `npm run db:seed` (mot de passe à changer à la 1re connexion)
   ADMIN_EMAIL="admin@exemple.com"
   ADMIN_PASSWORD=""

   # Notifications push (facultatif) : npx web-push generate-vapid-keys
   VAPID_PUBLIC_KEY=""
   VAPID_PRIVATE_KEY=""
   VAPID_SUBJECT="mailto:contact@exemple.com"
   ```

3. Créer les tables :

   ```bash
   npm run db:migrate
   ```

4. Créer le premier administrateur, avec `ADMIN_EMAIL` et `ADMIN_PASSWORD` :

   ```bash
   npm run db:seed
   ```

   Pour une démonstration, chargez en plus un jeu de données réaliste (personnel, 12 étudiants, un parent associé, deux semaines de repas et d'avis, stock). Le mot de passe de tous ces comptes est `Demo2026cantine` : `etudiant@demo.cantine`, `parent@demo.cantine`, `caisse@demo.cantine`, `chef@demo.cantine`.

   ```bash
   npm run db:demo
   ```

5. Lancer l'application sur http://localhost:3000 :

   ```bash
   npm run dev
   ```

**Mise en route :**
1. Connectez-vous avec le compte administrateur et changez son mot de passe.
2. Dans **Comptes**, créez les caissiers et le chef.
3. Le chef publie les menus.
4. Les usagers s'inscrivent sur `/inscription`, puis l'administrateur valide leur compte.

## Déploiement

**Docker (application complète en une commande)**

L'application et sa base PostgreSQL tournent dans deux conteneurs. Les valeurs sont lues dans le fichier `.env` du projet (`AUTH_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, clés `VAPID_*`) ; seul `AUTH_SECRET` est obligatoire.

```bash
docker compose up -d --build
```

Puis ouvrir http://localhost:3000. Au démarrage, le conteneur applique les migrations, crée le compte administrateur et charge les données de démonstration (`DEMO_DATA=true` par défaut ; mettre `DEMO_DATA=false` dans `.env` pour une base vide). Tout est idempotent : un redémarrage ne recrée rien.

- Suivre le démarrage : `docker compose logs -f app`
- Arrêter : `docker compose down` (les données restent dans le volume `pgdata`) ; tout effacer : `docker compose down -v`
- Changer de port : `APP_PORT=8080` dans `.env`
- La base du conteneur est indépendante de celle utilisée avec `npm run dev`.

En production, placez un reverse proxy HTTPS (Caddy, Nginx) devant le port 3000 : le cookie de session passe automatiquement en `Secure` dès que la requête arrive en HTTPS.

**Vercel + Neon** (recommandé)

1. **Base Neon** : sur [neon.tech](https://neon.tech), créez un projet `cantine-connect` en région **AWS Europe Central 1 (Frankfurt)**, la plus proche de l'Afrique de l'Ouest et alignée sur la région Vercel `fra1` déclarée dans `vercel.json`.
2. **Les deux chaînes de connexion** : dans *Connection Details*, copiez :
   - la chaîne **Pooled connection** (hôte contenant `-pooler`) → `DATABASE_URL`, en ajoutant à la fin `&pgbouncer=true&connect_timeout=15` ;
   - la chaîne **directe** (option *Connection pooling* désactivée) → `DIRECT_URL`.
3. **Variables Vercel** (Project → Settings → Environment Variables) : `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, `APP_TIMEZONE`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`.
4. **Déploiement** : le script `vercel-build` applique les migrations, crée le premier administrateur s'il n'existe pas, puis construit l'application. Aucune commande manuelle n'est nécessaire.

Pour vérifier une base depuis un poste (le mot de passe n'est jamais affiché) :

```bash
npm run db:check
```

Ne versionnez jamais ces chaînes : elles contiennent le mot de passe de la base. `.env` et `.env.*` sont ignorés par git.

Pour passer d'une base locale à Neon (base neuve ou copie des données existantes), suivez [docs/migration-neon.md](docs/migration-neon.md) : `npm run db:neon:check`, `db:neon:migrate`, `db:neon:seed`, `db:neon:copy`.

## Tests

Les tests portent sur les règles métier et tournent sur une vraie base PostgreSQL de test : réservations, heure limite, double passage concurrent, allergènes, QR falsifié ou révoqué, clôture de caisse, droits par rôle, limitation des connexions, association parent (code expiré, usage unique, cloisonnement), crédit Mobile Money unique malgré des confirmations simultanées, refus et expiration de paiement, notifications, notes et prévision. Un test vérifie aussi que chaque texte de l'interface et chaque message serveur a sa traduction anglaise, avec les mêmes paramètres.

```bash
createdb cantine_test
```

```bash
npm test
```

La base de test se configure avec `TEST_DATABASE_URL` (par défaut `postgresql://cantine:cantine@localhost:5432/cantine_test`).

## Architecture

```
prisma/              schéma, migrations (avec contraintes SQL), seed
src/server/          code serveur uniquement
  auth.ts            sessions, garde des pages
  pass.ts            signature et vérification des QR Codes
  notify.ts          notifications in-app
  payments/          passerelle Mobile Money (simulée en mode test)
  services/          règles métier (transactions, verrouillage, audit) : famille, paiements, avis…
src/i18n/            langues : détection, dictionnaire anglais, formats (montants, dates)
src/lib/             règles pures et libellés partagés serveur/interface
src/app/             pages et actions serveur par espace (espace, caisse, cuisine, admin)
src/components/      composants d'interface
tests/               tests des règles métier
scripts/             vérification de la base, jeu de démonstration
```

**Identité visuelle :** le ticket de cantine (encoches et ligne de découpe) sert de signature, du logo à l'écran d'accueil, au ticket du jour, au portefeuille et au pass. Couleurs de Vatel relevées sur le logo de l'école (noir `#1d1d1b` et bleu ciel `#89c1e8`, déclinées en palette `brand-*`), vert réservé au succès, titres en Bricolage Grotesque, texte en Inter (polices auto-hébergées).

## Prévu pour la suite

- Brancher les API réelles de Wave et d'Orange Money (avec webhook de confirmation) derrière `PaymentGateway`.
- Scan du QR Code par la caméra de la tablette.
- Notifications push et e-mail, suggestions de repas personnalisées, mode hors ligne de la caisse, multi-sites.
