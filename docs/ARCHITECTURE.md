# Elo de vie — Architecture (MVP)

> Cadre technique du MVP solo. Produit : voir [`BRIEF.md`](BRIEF.md) (fait office de PRD).
> Décisions validées le 2026-10-16. L'ancienne version fitness est dans [`archive/`](archive/).

## 1. Stack (reprise de BEYND)

| Couche | Choix | Statut |
|---|---|---|
| Frontend | React 18 + Vite, PWA (`vite-plugin-pwa`), mobile d'abord (390 px) | Repris |
| Styling | Tokens CSS du `design-system/`, **un seul thème sombre `data-theme="elo"`** | Nouveau thème, plus de thème par coach |
| Backend | Hono sur Node ≥ 22 | Repris |
| DB | SQLite via `node:sqlite` (zéro dépendance native), mono-user implicite (id = 1) | Infra reprise, schéma remplacé |
| LLM | Gemini `gemini-3.8-flash` (surchargeable via `GEMINI_MODEL`), structured output par function calling, mode mock sans clé | Repris, nouveau schéma de sortie. `gemini-2.5-flash` renvoie 404 aux nouvelles clés. |

La clé `GEMINI_API_KEY` reste dans `server/.env` (ignoré par git). Elle n'est jamais envoyée au client.

## 2. Modèle de données

```
user              id, name, created_at
categories        id (slug), name, ordre                        -- préremplie
goals             id, user_id, category_id, title, prompt (texte saisi),
                  difficulty (400–2200), coach_intro, is_main, status
                  ('active' | 'done' | 'archived'), created_at, completed_at
steps             id, goal_id, title, ordre, status ('todo' | 'done'), completed_at
tasks             id, step_id, label, ordre, xp, done_on (date ISO | NULL)
progress_events   id, user_id, category_id, goal_id, step_id, task_id,
                  kind ('task' | 'step_bonus' | 'boss'),
                  delta_xp, delta_elo (REAL), elo_after (REAL),
                  reverts_id (NULL | id de l'événement annulé), created_at
```

Écarts par rapport à l'esquisse du brief (§7) :
- **Pas de table `user_category_elo` ni de colonnes `xp`, `niveau` ou `série` sur `user`.** Tout est dérivé de `progress_events` : c'est la seule source de vérité. Ça rend l'annulation d'une coche exacte et donne les courbes gratuitement. On ajoutera un cache plus tard si les performances l'exigent.
  - Elo d'une catégorie = `1000 + Σ delta_elo`.
  - Courbe = suite des `elo_after`.
  - XP = `Σ delta_xp`.
- Catégories initiales : Tech, Langues, Sport, Carrière, Créatif, Autre. La liste est fermée et le validateur LLM la vérifie.
- Le premier objectif créé devient automatiquement `is_main`.

## 3. Règles de jeu (moteur pur `server/engine.js`, testé)

### Notations
- `diff` : difficulté de l'objectif.
- `elo` : Elo courant de la catégorie de l'objectif, **au moment de l'action**.
- `gain(diff, elo) = max(2, round((diff − elo) / 10 + 20))` (formule du brief).

### Elo
| Événement | Δ Elo |
|---|---|
| Tâche cochée | `gain / n`, où `n` = nombre de tâches de l'étape, arrondi à 0,1 |
| Dernière tâche d'une étape cochée → étape terminée | bonus `+ gain` (en plus du Δ de la tâche) |
| Dernière étape terminée → objectif terminé (boss) | `+ gain × 2` |

Le gain est recalculé à chaque action avec l'Elo courant : plus l'Elo monte, moins la même difficulté rapporte. Une même coche peut donc produire jusqu'à trois événements, enregistrés dans l'ordre : `task`, `step_bonus`, `boss`.

Exemple : objectif pentester (1850), Elo Tech 1000, étape de 5 tâches.
- `gain = round(850 / 10 + 20) = 105`.
- Chaque tâche donne ≈ +21. Il y a un léger tassement, car l'Elo monte à chaque coche.
- La fin de l'étape ajoute un bonus ≈ +95, recalculé avec l'Elo du moment.

### Décocher une tâche
- On enregistre un événement inverse (`reverts_id`) avec **exactement l'opposé** du Δ d'origine. On ne recalcule rien.
- Si l'étape était terminée, elle repasse en `todo` et son `step_bonus` est annulé aussi. Même chose pour le `boss` si l'objectif était terminé.
- Recocher ensuite recalcule le Δ avec l'Elo courant.

### XP, niveau, série
- XP par tâche, selon le palier de difficulté de l'objectif :

  | Palier | Difficulté | XP |
  |---|---|---|
  | Facile | < 800 | 10 |
  | Moyen | < 1400 | 20 |
  | Dur | < 1800 | 35 |
  | Élite | ≥ 1800 | 50 |

  La valeur est fixée sur la tâche à sa création.
- Niveau = `floor(XP / 1000) + 1`.
- Série = nombre de jours consécutifs, jusqu'à aujourd'hui ou hier, ayant au moins une tâche avec `done_on` à cette date.

### Elo de vie
Moyenne des Elo des catégories qui ont au moins un objectif non archivé. Vaut 1000 s'il n'y en a aucune.

### Hors MVP
- Rendements décroissants (ils supposent des tâches récurrentes : v1.1).
- Baisse d'Elo par inactivité (règle à valider).
- Recalibrage communautaire (v2).

## 4. Coach IA

- **Un seul coach.** Les personas Max, Sam et Nova sont retirées, ainsi que le changement de thème. Son seul rôle : analyser un objectif et présenter le plan. Pas de chat dans le MVP.
- Appelé **uniquement** à la création ou à la modification d'un objectif.
- Sortie structurée (fonction `proposer_plan`), validée côté serveur :

```json
{
  "title": "Devenir pentester (eJPT)",
  "category": "tech",
  "difficulty": 1850,
  "intro": "2–3 phrases qui présentent le plan, adressées à « tu ».",
  "steps": [
    { "title": "Pre Security", "tasks": ["Room How the Web Works", "Room Linux Fundamentals 1"] }
  ]
}
```

- Règles du validateur :
  - `category` ∈ liste fermée, sinon `autre`.
  - `difficulty` ramenée dans [400, 2200].
  - Au plus 8 étapes et 10 tâches par étape : le surplus est coupé, les libellés vides sont retirés, et le titre manquant est remplacé par le texte saisi.
  - Sortie inutilisable (aucune étape exploitable, difficulté non numérique, erreur API) : une relance, puis `CoachError` → 502.
- Le prompt demande des tâches concrètes et cochables, qui renvoient aux ressources externes (TryHackMe, appli de langue…). L'app ne fournit pas de contenu.
- **Mock sans clé** : renvoie le plan pentester du brief (§9) pour que tout le parcours soit jouable.
- **Rollback** (repris de BEYND) : l'analyse ne crée rien en base. L'insertion se fait seulement à la confirmation, dans une transaction.

## 5. API

| Méthode | Route | Rôle |
|---|---|---|
| GET | `/api/state` | Accueil : profil (XP, niveau, série), Elo de vie + courbe, Elo par catégorie, Quête du jour, objectif principal |
| POST | `/api/goals/analyze` | `{ prompt }` → proposition du coach (rien n'est persisté) |
| POST | `/api/goals` | Proposition éventuellement modifiée par l'utilisateur → création en transaction |
| GET | `/api/goals?category=` | Liste des objectifs : palier, difficulté, gain potentiel, avancement |
| GET | `/api/goals/:id` | Détail : étapes et tâches |
| PATCH | `/api/goals/:id` | Titre, `is_main`, `status` (archiver) |
| POST | `/api/tasks/:id/toggle` | Coche ou décoche → événements, puis renvoie l'état mis à jour et les événements produits (pour les célébrations) |
| GET | `/api/progress` | Courbes d'Elo par catégorie, historique jour par jour, séries |

**Quête du jour** : pour chaque objectif actif, les 3 prochaines tâches non faites de la première étape en `todo`, dans l'ordre. L'objectif principal passe en premier. On y ajoute les tâches cochées aujourd'hui, pour pouvoir les décocher. Le gain affiché dépend de l'état de la tâche : pour une tâche à faire, c'est le gain potentiel (`gain / n` à l'Elo courant) ; pour une tâche cochée, c'est ce qu'elle a réellement rapporté.

`/api/state` renvoie aussi la variation du jour : `life_elo.delta_today` et `categories[].delta_today`. Elle se calcule sur la journée de jeu en cours.

Précisions d'implémentation :
- Code serveur : `engine.js` (règles pures) ← `game.js` (lectures et écritures en base) ← `app.js` (routes Hono, construites par `createApp({ db, analyze, clock })` pour les tests) ← `index.js` (démarrage).
- `analyze` renvoie `{ prompt, proposal, preview }`. `preview` contient le palier, l'XP par tâche, l'Elo de la catégorie et le gain potentiel. `POST /api/goals` reçoit ce même objet, éventuellement modifié, et le revalide.
- Codes d'erreur : 400 (saisie invalide), 404 (introuvable), 409 (conflit, par exemple cocher une tâche d'un objectif archivé), 502 (coach indisponible).
- « Aujourd'hui » = journée de jeu, en heure locale du serveur. Elle commence à `DAY_START_HOUR` (4 h par défaut) : une coche à 1 h compte pour la veille. Ça vaut pour `done_on`, la série, l'historique et les courbes.
- Archiver l'objectif principal fait passer le rôle d'objectif principal à l'objectif restant le plus ancien.
- `ELO_DB_PATH` permet d'utiliser une base jetable. `npm run mock` démarre le serveur sans charger `.env`, donc sans Gemini.
- **Démo** : `npm run demo:xp` (dans `server/`) ajoute l'XP qui manque pour arriver à 5 XP du niveau suivant ; la prochaine coche déclenche donc la célébration de niveau. `npm run demo:xp -- 1500` donne un montant exact. C'est une ligne `task` du journal sans `task_id` et à Δ Elo nul : aucune décoche ne l'annule. Il faut au moins un objectif.

## 6. Front

- Onglets du bas : **Accueil · Objectifs · Progrès · Profil**.
- Thème `elo` : palette du brief (§8), polices Archivo et Silkscreen. Silkscreen est réservée aux labels pixel (niveau, XP, badges). Le thème est défini dans `design-system/tokens/theme-elo.css` et appliqué par `data-theme="elo"` sur `<html>`.
  - Paliers : Facile en vert, Moyen en bleu, Dur en or, Élite en rose. Le brief ne donne pas de couleur pour « Dur ».
  - Couleurs de catégorie : Tech bleu, Langues rose, Sport vert, Carrière or, Créatif orange, Autre gris chaud. Elles servent pour les tracés et les pastilles, jamais pour le texte.
- **Création d'objectif** (onglet Objectifs → « + Nouveau ») : texte saisi → analyse du coach → aperçu modifiable → confirmation. Dans l'aperçu, on peut modifier le titre, la catégorie, la difficulté (avec « rétablir » l'estimation du coach), les étapes et les tâches. La logique d'édition est dans `client/src/lib/plan.js`, sans React et testée avec `npm test`.
- **Le client importe `server/engine.js` directement** (le module n'a aucune dépendance). Le gain potentiel, le palier, l'XP et les limites (8 étapes, 10 tâches) viennent donc de la même source des deux côtés.
- **Une courbe par catégorie (petits multiples), jamais superposées.** Ça applique la règle « on ne compare pas deux catégories ». C'est aussi nécessaire en pratique : avec 6 couleurs sur fond sombre, aucune palette ne reste distinguable par paires (le validateur dataviz échoue). `LineChart` ne trace donc qu'une série. Chaque courbe d'Elo part de 1000 la veille du premier point.
- Repris de BEYND :
  - `api.js` ;
  - structure d'`App.jsx` + barre d'onglets ;
  - `Card`, `Button`, `Badge`, `XPPill`, `Input` ;
  - `StatTile` et `Meter` ;
  - `WeightChart`, généralisé en `LineChart` multi-séries.
- Nouveau :
  - avatar pixel en SVG `crispEdges` ;
  - liste de la Quête du jour (reprise de `Log.jsx`) ;
  - parcours de création (saisie → analyse → aperçu modifiable → confirmation) ;
  - célébration à la fin d'une étape et du boss.
- **Accueil** (de haut en bas) :
  - avatar pixel, dont la tunique change de couleur avec le niveau (bleu, puis vert au niveau 5, or au 10, rose au 20) ;
  - niveau, barre d'XP et série (flamme) ;
  - Elo de vie, sa variation du jour et sa courbe ;
  - Quête du jour à cocher ;
  - Elo des catégories actives ;
  - objectif principal, avec le gain du boss.
- **Retours après une coche** : une coche simple ou une décoche affiche un toast (Elo, XP). Une étape terminée, un boss vaincu ou un niveau gagné ouvrent une célébration plein écran avec confettis pixel, désactivés si le système demande moins d'animations. La logique est dans `client/src/lib/home.js`, testée.
- Sans objectif, l'Accueil propose « Créer un objectif », qui ouvre directement le parcours de création.
- **Objectifs** :
  - filtres par catégorie (puces « Tous » + catégories qui ont des objectifs, avec leur nombre) et puce « Archivés » ;
  - chaque carte montre le palier, la difficulté, l'avancement, le gain d'une étape et celui du boss (×2) à l'Elo courant ;
  - le détail d'un objectif liste toutes les étapes et tâches, cochables comme dans la Quête du jour (même toast, mêmes célébrations, via `useTaskToggle`). Les étapes franchies sont repliées. On peut renommer, définir comme principal, archiver ou réactiver ;
  - la carte « Objectif principal » de l'Accueil ouvre directement son détail. Logique pure dans `client/src/lib/goals.js`, testée.
- **Progrès** :
  - séries (actuelle, meilleure, jours joués) et grille d'activité des 5 dernières semaines, lundi en premier ;
  - une courbe d'Elo par catégorie ayant un objectif ou de l'activité, chacune avec sa variation depuis 1000 ;
  - historique jour par jour (Δ Elo net, XP, tâches encore cochées), 10 jours à la fois. `/api/progress` renvoie aussi `today`. Logique pure dans `client/src/lib/progress.js`, testée.
- - Retiré : Chat, Onboarding, Settings fitness, mesures de poids, `coaches.js` multi-personas.

## 7. Ordre de build

| Étape | Contenu | Fin d'étape |
|---|---|---|
| É0 | Docs (ce fichier) | Validé |
| É1 | `engine.js` + tests `node:test` | `npm test` passe |
| É2 | Schéma DB | La base se crée vide et propre |
| É3 | Coach Gemini (analyse + mock) | JSON valide, avec ou sans clé |
| É4 | API | Parcours complet testé avec curl |
| É5 | Fondations front (thème, onglets, `LineChart`) | Coquille navigable |
| É6 | Création d'objectif | Cas pentester créé de bout en bout |
| É7 | Accueil | Cocher une tâche met tout à jour |
| É8 | Objectifs + Progrès | MVP complet ✔ |
| É9 | Finitions, nettoyage du code fitness, README, manifeste PWA | Prêt pour la démo |

## 8. Post-MVP (ne pas builder maintenant)

Tâches récurrentes et rendements décroissants, baisse d'Elo par inactivité, raids du dimanche, collection de monstres, recalibrage communautaire, auth et multi-user (→ Postgres).
