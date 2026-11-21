# Audit d'interface — CantineConnect v6 — 18 novembre 2026

Audit sans modification du code. Grilles utilisées : `impeccable` (audit technique noté sur 20), `web-design-guidelines` (règles Vercel à jour du jour), `make-interfaces-feel-better`, `frontend-design`, `motion-design`, `vercel-react-best-practices`, les skills responsive (`responsive-design`, `mobile-responsiveness`, `Frontend Responsive Design Standards`) et le CLAUDE.md du projet, qui prime en cas de conflit.

**Périmètre vérifié dans le navigateur** (serveur de dev, comptes de démo) :
- 390 px : accueil animé, connexion, inscription, `/espace` (les deux semaines), portefeuille, pass, profil, `/famille`.
- 1280 px : caisse (recherche d'un usager), cuisine, menus, stock.

**Non couvert :** l'espace admin (pas de compte admin de démo, audit du code seulement) ; les actions qui modifient les données (valider un repas, recharger, réserver) ; le détecteur automatique d'`impeccable` (il télécharge un exécutable) ; un vrai téléphone.

## Suivi des corrections — 18 novembre 2026, soir

Les P1 et P2 sont traités. `npm run typecheck`, `npm test` (35/35) et `npm run build` passent. Les corrections ont été vérifiées dans le navigateur à 390 px (`/espace`, portefeuille, pass, profil, connexion, accueil) et à 1280 px (`/espace`, connexion, menus du chef).

| # | Constat | Statut |
|---|---|---|
| 1 | Contraste `slate-400` | **Corrigé** : 37 textes et boutons icônes passés en `slate-500`. Les 21 icônes décoratives placées à côté d'un texte restent en `slate-400`. |
| 2 | Zones tactiles | **Corrigé** : plus aucune commande sous 44 px sur les écrans revérifiés. Voir le détail ci-dessous. |
| 3 | `h2` avant le `h1` | **Corrigé** : l'accroche « Le déjeuner, sans la file d'attente » est un `p` (`app/(auth)/layout.tsx`). Le `h2` n'était visible que sur bureau ; à 390 px il était masqué, donc ignoré des lecteurs d'écran. |
| 4 | Splash à chaque ouverture | **Corrigé** : une fois par session (`sessionStorage`, clé `cc-splash-vu`). Au second passage, `/` mène à l'espace en moins d'une seconde. Le splash se passait déjà d'un tap : sur ce point, l'audit se trompait. Pour le rejouer pendant le pitch, ouvrez un nouvel onglet. |
| 5 | `theme-color` | **Faux positif, rien changé** : l'en-tête de l'application est blanc (`bg-white/85`), donc une barre système blanche s'y raccorde. |

**Détail des zones tactiles :**
- Nouvelle classe `.hit` dans `globals.css` : elle agrandit la zone de toucher à 44 × 44 px par un pseudo-élément, sans changer le visuel. Appliquée à :
  - `Button` (taille `sm` comprise) et `Segmented` ;
  - FR/EN (plus `min-w-11`), onglets Connexion/Inscription, œil du mot de passe ;
  - cloche, menu du compte, logo ;
  - « Ne plus suivre », « Modifier », jours du planning.
- Agrandis pour de bon :
  - `Button` taille `md` passe à 44 px ;
  - étoiles de notation en 44 × 44, avec une icône de 24 px ;
  - puces d'allergènes de 44 px de haut ;
  - « Retirer », publier, dépublier et supprimer un menu en 44 × 44 ;
  - Nutri-Score en 44 px ;
  - « Téléphone perdu » de 44 px de haut.
- Ligne « Votre avis ? » du ticket du jour : des marges négatives gardent les cinq étoiles sur une ligne à 390 px. Si la place manque, elles passent à la ligne sous le libellé.

**P3, traités dans un second temps.** `npm run typecheck`, `npm test` (36/36, avec un nouveau test sur l'élision) et `npm run build` passent. Vérifié à 390 px sur `/connexion` et `/famille`, en français et en anglais.

| # | Constat | Statut |
|---|---|---|
| 6 | Placeholders sans « … » | **Corrigé** : 9 textes traduits, avec leur anglais, et 2 littéraux (`07 00 00 00 00…`, `K7PM-4QX9…`). « Un mot pour la cuisine ? » devient « Un mot pour la cuisine… ». |
| 7 | Effet d'appui hétérogène | **Corrigé** : `active:scale-[0.96]` partout (`Button`, bouton d'accès, ticket du jour, étoiles, allergènes). |
| 8 | « Les repas de Aya » | **Corrigé** : nouvel utilitaire `elides()` dans `src/lib/utils.ts`, qui gère les voyelles, les accents et le h muet. Il couvre 5 textes : « Les repas d'Aya », « Ce qu'Aya a mangé », « Recharger le compte d'Aya », « Connecté en tant qu'… » et la notification « Portefeuille d'Aya rechargé ». Un test est ajouté dans `tests/i18n.test.ts`. |
| 9 | « QR \| Code » coupé | **Corrigé** : espace insécable U+00A0 dans la source et dans `en.ts`, avec un commentaire pour qu'elle ne se perde pas. |
| 10 | `formatMoney` inutilisé | **Corrigé** : imports retirés de `admin.ts`, `payments.ts` et `pos.ts`. Les fonctions mortes `formatMoney` et `formatNumber`, en français seulement, sont supprimées de `src/lib/utils.ts`. |
| 11 | Mouvement réduit | **Corrigé** : avec `prefers-reduced-motion`, les entrées `.anim-rise` / `.anim-fade` gardent un fondu de 150 ms, sans déplacement ni délai. Les autres animations restent coupées. Non vérifié dans le navigateur : le panneau ne simule pas ce réglage. |

**Oubli du lot P1, rattrapé :** cinq liens et boutons écrits à la main imitaient l'ancien `Button md` de 40 px. Ils passent à 44 px :
- « Associer un enfant » ;
- « Planifier les menus » ;
- le lien vers la cuisine dans l'admin ;
- « Afficher » et l'export CSV dans les finances.

## Note globale initiale : 16 / 20 — Bon

| # | Dimension | Note | Point principal |
|---|---|---|---|
| 1 | Accessibilité | 3 | Texte gris clair `text-slate-400` sous le contraste minimum (32 endroits) |
| 2 | Performance | 3 | Écran d'accueil de 3 s à chaque ouverture de `/` |
| 3 | Thème | 3 | `theme-color` blanc, différent de la marque et du fond de page |
| 4 | Responsive | 3 | Aucune barre horizontale à 390 px, mais beaucoup de zones tactiles sous 44 px |
| 5 | Cohérence | 4 | Direction artistique du ticket tenue partout |

**Cohérence : réussi.** Le motif du ticket (encoches, découpe pointillée, vert profond) revient du splash au ticket du jour, au portefeuille, au pass et à l'espace parent. Les composants partagés (`Card`, `Button`, `Badge`, `PageTitle`) sont utilisés partout, sans dérive visible. Rien ne ressemble à un gabarit générique.

**Problèmes trouvés :** 0 bloquant (P0), 2 majeurs (P1), 3 mineurs (P2), 6 finitions (P3).

## P1 — À corriger avant le pitch

### 1. Texte trop pâle (contraste insuffisant)
- **Où :** 32 textes en `text-slate-400` sur fond blanc, par exemple :
  - `app/(auth)/connexion/LoginForm.tsx:88` (« Mot de passe oublié ? »)
  - `app/espace/pass/page.tsx:43` (« Allergies signalées en caisse »)
  - `components/caisse/PosScreen.tsx:40`
  - `app/cuisine/page.tsx:195` et `:226`
  - `components/admin/PendingReview.tsx:40`
- **Impact :** un contraste d'environ 2,6:1, contre 4,5:1 exigé (WCAG AA 1.4.3). C'est illisible au soleil sur un téléphone, et c'est souvent du texte utile (allergies, aide).
- **Correction :** `text-slate-500` (4,8:1) pour tout texte qui porte une information. Garder `slate-400` pour les icônes et les placeholders.

### 2. Zones tactiles sous 44 px sur mobile
Le CLAUDE.md demande au moins 44 px. Mesures à 390 px :

| Élément | Taille | Fichier |
|---|---|---|
| `Button` taille `md`, utilisé pour « Recharger », « Réserver », « Annuler la réservation », « Générer un code » | 40 px de haut | `components/ui.tsx:63` |
| `Button` taille `sm` (22 usages) | 32 px | `components/ui.tsx:62` |
| Étoiles de notation | 24 × 24 | `components/ui.tsx:309` |
| Puces d'allergènes (profil, menus) | 28 px de haut | `components/AllergenPicker.tsx:22` |
| Sélecteur FR / EN | 25 px de haut | en-tête |
| « Ne plus suivre Aya » (action destructive) | 16 px de haut | `components/famille/UnlinkChild.tsx:16` |
| « Retirer Marie » | 32 × 32 | `components/espace/FamilyLinks.tsx:108` |
| « Modifier » (avis) | 16 px de haut | `components/espace/MenuWeek.tsx:207` |

- **Impact :** des taps ratés sur la notation et les allergies, deux fonctions mises en avant dans le pitch.
- **Correction :**
  - Passer `md` à `h-11`.
  - Agrandir la zone cliquable sans changer le visuel, avec un pseudo-élément (`before:absolute before:-inset-2`) sur les étoiles, les puces et les liens texte.

## P2 — À corriger si le temps le permet

### 3. Ordre des titres sur les écrans d'accès
Un `h2` (« Le déjeuner, sans la file d'attente ») précède le `h1` sur `/connexion` et `/inscription` (`app/(auth)/layout.tsx:70`). Un lecteur d'écran annonce d'abord un sous-titre. Correction : remplacer ce `h2` par un `p` stylé de la même façon.

### 4. Écran d'accueil de 3 s à chaque ouverture
`app/Splash.tsx:12` : 2,35 s d'attente plus 0,65 s de sortie, à chaque visite de `/`, donc à chaque lancement de l'application installée. Il se passe au clavier, mais pas au toucher.
- Le montrer une fois par session (`sessionStorage`).
- Le passer d'un tap (`pointerdown`).

Au pitch, il restera visible la première fois.

### 5. Couleur de la barre système
`app/layout.tsx:21` : `themeColor: "#ffffff"`, alors que le fond des pages vaut `#f6f8f7` et que la marque est en vert profond. Sur Android et dans l'application installée, la barre d'état ne se raccorde pas à la page. Correction : `#f6f8f7`, ou le vert `emerald-950` si l'en-tête devient sombre.

## P3 — Finitions

6. **Placeholders sans « … »**, contrairement à la règle du CLAUDE.md : e-mail `prenom.nom@exemple.com`, code parent `K7PM-4QX9`.
7. **Effet d'appui hétérogène :** `scale-[0.98]` sur `Button`, `0.99` sur le bouton d'accès, `0.95` sur les puces. `make-interfaces-feel-better` recommande une seule valeur, `0.96`.
8. **« Les repas de Aya »** devrait être « Les repas d'Aya ». L'élision devant une voyelle manque dans les textes construits avec `{name}` (espace parent).
9. **Le titre du pass coupe « QR | Code »** sur deux lignes. Une espace insécable (`QR Code`) dans la source et dans la traduction suffit.
10. **Imports inutilisés** de `formatMoney` dans `server/services/admin.ts:7`, `payments.ts:5` et `pos.ts:5`. Cette fonction ne formate qu'en français ; à supprimer pour éviter qu'elle serve un jour à un texte affiché en anglais.
11. **Mouvement réduit :** la règle globale ramène toutes les animations à 0,01 ms. C'est acceptable. `impeccable` préférerait un fondu court plutôt qu'une coupure pour les retours d'état (validation en caisse, coche).

## Ce qui fonctionne bien

- **390 px :** aucune barre de défilement horizontale sur les 9 écrans testés. Barre d'onglets en bas, `safe-area` gérée.
- **Formulaires :** chaque champ a un label. Aucun bouton icône sans nom. Les erreurs sont annoncées (`role="alert"`, toasts en `aria-live`). Le focus reste visible : les champs sans contour natif ont un anneau `focus-within` sur leur conteneur.
- **Navigation :** lien « Aller au contenu ». État dans l'URL (`?semaine=`, `?jour=`). Les suppressions passent par `ConfirmDialog`.
- **Mouvement :** aucun `transition-all`. Les animations portent sur `transform` et `opacity`. `prefers-reduced-motion` est géré, y compris dans le splash.
- **Toucher :** `touch-action: manipulation`, surbrillance au toucher aux couleurs de la marque, pas d'effet élastique à la souris.
- **Langues :** dates et montants passent tous par `Intl` via `i18n/core.ts` ; `tabular-nums` sur les montants.
- **Titres :** un seul `h1` par page dans les espaces connectés ; `text-balance` sur `PageTitle`.

## Ordre de correction proposé

1. **[P1]** Contraste : `slate-400` → `slate-500` sur les textes porteurs d'information. Environ 30 minutes.
2. **[P1]** Zones tactiles : `Button md` en `h-11`, zone élargie sur les étoiles, les puces, FR/EN et les liens d'action. Environ 1 heure.
3. **[P2]** Titre d'accès en `p`, splash une fois par session, `theme-color`. Environ 30 minutes.
4. **[P3]** Finitions 6 à 11, au fil de l'eau.

Après chaque lot, il faudra relancer `npm run typecheck`, `npm test` et `npm run build`, puis vérifier à 390 px et sur bureau.
