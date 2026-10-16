# BEYND — PRD (MVP fitness)

> BMAD-light. Scope figé ci-dessous. Toute feature hors de ce doc = post-MVP.
> Décisions produit validées en session le 2026-07-12.

## 1. Vision & positioning

Plateforme de coaching conversationnel. L'utilisateur choisit un coach (1 parmi 3
personas) qui l'accompagne sur un projet-objectif structuré, principalement via
**chat**. Positionnement entre Whoop (data-driven, sérieux) et un vrai coach humain
(personnalité, caractère) — accountability conversationnelle, pas gamification-first.

**MVP = fitness / perte de poids.** L'architecture est pensée extensible (langues,
apprentissage, carrière) sans redesign, mais **rien d'autre que fitness n'est buildé
dans le MVP.**

## 2. Utilisateur cible (MVP)

Une seule personne (mono-user, pas d'auth). But du MVP : valider l'expérience
coach + chat + accountability sur un objectif fitness réel. Multi-user + auth =
post-MVP, seulement si le modèle convainc.

## 3. Les 3 coachs

Chaque coach = personnalité + thème visuel complet (swap via `data-theme`).

- **Max** — cool jeune, fun, motivant. Thème crème + orange brûlé. Emoji autorisés.
- **Sam** — pote cash, direct, no-BS. Thème blanc clean + bleu vif. Zéro emoji.
- **Nova** — data-nerd, analytique, chiffres. Thème dark + néon cyan. Zéro emoji.

Ton global : "tu", direct mais chaleureux. Jamais pastel-wellness, jamais
hardcore/warrior. Détails de voix : voir `design-system/readme.md` (Content Fundamentals).

## 4. Boucle d'usage core

1. **Setup (onboarding conversationnel)** : user choisit un coach → le coach
   l'interviewe en chat (objectif, poids actuel/cible, niveau, dispo/sem, contraintes).
2. **Génération du plan** : à la fin de l'interview, le coach (LLM) génère un
   **programme hebdo personnalisé** — engagements concrets (ex : 3 séances/sem,
   20 pompes, 15 abdos), structurés et cochables.
3. **Quotidien** : le user log son poids et **coche ses engagements réalisés** sur
   un écran dédié. Le coach commente ensuite dans le chat.
4. **Accountability** : à l'ouverture de l'app, si séance ratée / pas de log depuis
   X jours, le coach ouvre le chat avec un message contextuel (généré LLM à la volée).
5. **Switch de coach** : possible à tout moment sur le même projet ; l'historique et
   le plan restent, seul le thème + le ton changent.

## 5. Features must-have (in scope)

**P0 — cœur, à builder en premier**
- Onboarding conversationnel (coach interviewe → génère le plan).
- Chat coach (surface principale) + bandeau métriques en tête (poids actuel,
  tendance 7j, objectif, progression semaine) comme les réfs visuelles.
- Écran Log / Checklist : saisie poids + cocher les engagements du jour.
- Génération LLM du programme perso (JSON structuré, validé).
- Réponses coach en chat, persona + thème selon le coach actif.
- Switch de coach (thème swap, `coach_id` porté par chaque message).

**P1 — même MVP, juste après P0**
- Écran Dashboard : progression détaillée, graphes.
- Écran Historique : mesures passées, jour par jour.
- Écran Réglages : modifier projet / profil.
- Check-ins proactifs à l'ouverture (message contextuel LLM).

## 6. Hors scope MVP (post-MVP, ne pas builder)

- Auth / comptes multi-users.
- Push notifications réelles hors-app (relances programmées background).
- Domaines autres que fitness (langues, carrière…).
- Templates de programme fixes (le plan est 100% généré LLM).
- Avatars 3D finaux (fallback disque + glow ring suffit pour le MVP).
- Social, partage, classements, badge wall.

## 7. Critères de succès MVP

- Un user peut : choisir un coach, faire l'onboarding, recevoir un plan généré,
  logger poids + cocher engagements, et tenir une conversation cohérente et
  in-persona avec son coach sur ≥ 1 cycle hebdo.
- Le switch de coach change bien ton + thème sans casser l'historique ni le plan.
- Les métriques affichées (poids, tendance, adhérence) reflètent les données loggées.

## 8. Points ouverts / à trancher au build

- **Conflit design à résoudre** : `docs/design-decisions.md` décrit frosted-glass +
  gradients + blur ; `design-system/readme.md` (système exporté) impose flat/opaque,
  zéro blur, zéro gradient. → **Le système exporté fait foi** (voir ARCHITECTURE.md).
- Durée de projet par défaut (réfs montrent "Semaine 3 / 12" → 12 semaines à confirmer).
- Fréquence exacte des check-ins d'ouverture (seuil "X jours sans log").
