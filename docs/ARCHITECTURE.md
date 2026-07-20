# BEYND — Architecture (MVP)

> Cadre technique du MVP fitness mono-user. 1 page. Voir `PRD.md` pour le scope produit.

## 1. Stack & justification

| Couche | Choix | Pourquoi |
|---|---|---|
| Frontend | **React + Vite**, PWA (`vite-plugin-pwa`) | Design-system déjà en composants React (JSX) + tokens CSS. PWA = installable, mobile-first, ouvre la porte au push post-MVP sans changer de stack. |
| Styling | **CSS tokens du design-system** (`data-theme`) | Thèmes par coach déjà définis (`tokens/colors.css`). Rien à réinventer. |
| Backend | **Node léger** (Hono ou Express), serverless-friendly | La clé API Anthropic **ne doit jamais être côté client** → un proxy serveur est obligatoire, même en mono-user. Sert aussi la persistance. |
| DB | **SQLite** (`better-sqlite3`) | Mono-user, zéro infra. Schéma pensé pour migrer vers Postgres quand multi-user arrive. |
| LLM | **Claude API (Anthropic)** — `claude-sonnet-5` par défaut | Bon équilibre coût/latence pour du chat volumineux + génération structurée. `claude-opus-4-8` en option pour la génération de plan si besoin de plus de finesse. |

**Mobile-first** : layout pensé téléphone d'abord, chat = surface fixe (composer en
bas, header coach en haut, historique scroll au milieu), écrans secondaires via bottom
tab bar.

## 2. Résolution du conflit design

`design-decisions.md` (frosted-glass, gradients, blur) **vs** `design-system/readme.md`
(flat, opaque, zéro blur/gradient). → **Le design-system exporté fait foi** : surfaces
plates opaques, bordures 1px, glow réservé au token `--shadow-glow-primary` (état actif
uniquement). `design-decisions.md` est un doc de phase antérieure.

## 3. Structure de données

```
User (singleton MVP)      : id, poids_depart, poids_cible, taille, niveau,
                            dispo_par_semaine, contraintes
Project                   : id, user_id, objectif, coach_id_actif, date_debut,
                            duree_semaines, statut
Coach (constantes code,   : id, nom, persona, theme, system_prompt
       pas en DB)           (max | sam | nova)
Program                   : id, project_id, semaine, plan_json (engagements générés LLM),
                            genere_le
Engagement                : id, program_id, jour, libelle, cible (reps/qty/bool),
                            fait (bool), date
Measurement               : id, project_id, date, poids
Message                   : id, project_id, role (user|coach), coach_id (auteur si coach),
                            contenu, data_card_json (optionnel), timestamp
```

Notes :
- **`coach_id` sur chaque message** = requis parce que le coach est switchable :
  l'historique doit savoir qui a parlé pour rendre le bon avatar/thème/ton.
- **Coach = constantes code**, pas une table : 3 personas figés, versionnés avec l'app.
- Schéma volontairement compatible Postgres (types simples, FK explicites) pour la
  migration multi-user post-MVP.

## 4. Points d'intégration LLM

Tous les appels passent par le backend (clé API server-side). 4 usages :

1. **Onboarding (chat libre)** — conversation d'interview. System prompt = persona du
   coach choisi. Objectif : collecter objectif/poids/niveau/dispo.
2. **Génération du programme** — **tool use / structured output** : le modèle retourne
   un `plan_json` conforme à un schéma strict (semaines → jours → engagements
   {libellé, cible}). Validé côté serveur avant persistance ; re-prompt si invalide.
3. **Réponses coach en chat** — system prompt = règles de voix du coach actif (voir
   `readme.md` Content Fundamentals : "tu", emoji seulement Max, ton par persona).
   Contexte injecté : métriques récentes + engagements cochés/ratés + historique récent.
4. **Check-ins d'ouverture (P1)** — à l'ouverture, si séance ratée / pas de log depuis
   X jours, appel LLM contextuel qui ouvre le chat avec un message in-persona.

**Persona = system prompt paramétré par `coach_id`.** Un seul pipeline d'appel, le
system prompt (ton, thème, règles emoji) est injecté selon le coach actif. Au switch,
seul le system prompt change ; l'historique reste partagé.

## 5. Découpage suggéré (build order)

1. Design-system → composants React montés + thèmes `data-theme` fonctionnels.
2. Backend proxy Anthropic + SQLite + schéma ci-dessus.
3. P0 : onboarding conversationnel → génération plan → chat → log/checklist.
4. P1 : dashboard, historique, réglages, check-ins d'ouverture.

## 6. Post-MVP (ne pas builder maintenant)

Auth + multi-user (→ Postgres, isolation par user), push notifications réelles
(background jobs + push tokens), domaines non-fitness (généraliser `Project`),
avatars 3D finaux.
