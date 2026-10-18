# Brief produit — BEYND

> L'app s'appelle **BEYND**. « Elo de vie » est le nom du score global (§ tableau des scores).

## 1. Vision
Une app pour se dépasser : on pose ses objectifs de vie, on les découpe en tâches, on coche, et on voit sa progression. Pas de cours : le contenu vient d'ailleurs (TryHackMe, appli de langue, salle de sport…). L'app est la couche **motivation + suivi + coaching**.

Inspirations : **chess.com** (interface sombre et sérieuse, Elo, courbes, séries) × **Habitica** (pixel art, XP, quêtes, monstres). Le fun est en touches (avatar, monstres, célébrations), pas dans toute l'interface.

Différenciation : un **coach IA** construit le plan à partir d'un objectif, estime sa difficulté et l'ajuste selon ce que l'utilisateur fait vraiment. Habitica oblige à tout saisir soi-même.

## 2. Boucle centrale
1. L'utilisateur crée un objectif (ex. « Devenir pentester »).
2. Le coach l'analyse : type (projet ou routine), catégorie, difficulté (rating), puis étapes et tâches pour un projet, ou habitudes et jalons pour une routine.
3. Chaque jour, l'accueil affiche la « Quête du jour » : les tâches des projets et les séances prévues des routines.
4. Cocher une tâche ou une séance → XP (niveau du personnage) + Elo de la catégorie.
5. La progression se voit : courbe d'Elo, séries de jours, étapes franchies, « boss final » (l'objectif).

## 3. Concepts
| Concept | Définition |
|---|---|
| Objectif | Ce qu'on veut atteindre. A une catégorie, une difficulté et un **type** : projet ou routine. |
| Projet | Objectif qu'on termine une fois, par une suite d'étapes dans l'ordre (ex. « Devenir pentester »). |
| Routine | Objectif qui consiste à tenir un rythme (ex. « Reprendre la lecture », « Callisthénie jusqu'au muscle-up »). Il a des habitudes et, éventuellement, des jalons. |
| Habitude | Action récurrente d'une routine, avec une fréquence par semaine (ex. « Lire 20 min », 5 fois/semaine). On la coche au plus une fois par jour : c'est une **séance**. |
| Semaine tenue | Semaine (lundi → dimanche) où chaque habitude de la routine a atteint sa fréquence. |
| Jalon | Réussite ponctuelle d'une routine, sans ordre imposé (ex. « Premier muscle-up »). On le coche le jour où on l'atteint. |
| Étape | Jalon d'un objectif (ex. « Pre Security »). |
| Tâche | Action concrète et cochable, rattachée à une étape. Donne de l'XP. |
| Catégorie | Tech, Langues, Sport, Carrière, Créatif… Chaque catégorie a **son propre Elo**. |
| Difficulté | Rating de l'objectif (400 → 2200). Paliers : Facile < 800, Moyen < 1400, Dur < 1800, Élite ≥ 1800. |
| XP / Niveau | Progression globale du personnage (avatar pixel). 1 000 XP par niveau. |
| Elo de vie | Moyenne des Elo de catégorie. |
| Série | Nombre de jours consécutifs avec au moins une tâche ou une séance cochée. |

## 4. Règles d'équité (Elo)
Principe : comme aux échecs, on ne compare jamais deux catégories entre elles (Bullet ≠ Blitz), et un objectif au-dessus de son niveau rapporte plus qu'un objectif facile (comme les puzzles notés de chess.com).

- **Gain à la complétion d'une étape ou d'un objectif** :
  `gain = max(2, round((difficulté − Elo_catégorie) / 10 + 20))`
  Ex. italien (1900) avec Elo Langues 980 → +112. Ranger son bureau (450) avec Elo Carrière 1050 → +2.
- **Routines** : la régularité rapporte plus que le volume. Une séance rapporte un peu ; une semaine tenue rapporte autant qu'une étape de projet, un jalon aussi. Le boss d'une routine est une série de semaines tenues d'affilée.
- **Rendements décroissants** : une habitude ne se coche qu'une fois par jour, et les séances au-delà de la fréquence prévue rapportent moitié moins. Comme le gain baisse quand l'Elo monte, une routine facile finit par ne plus rapporter que le minimum : pour progresser, il faut viser plus haut.
- **Monter d'un cran** : le gain d'une routine suit la formule de difficulté, donc il tend vers +2 dès que l'Elo de la catégorie dépasse la difficulté de la routine. À ce moment, la Quête du jour propose de monter d'un cran : une séance de plus par semaine, ou une habitude plus exigeante (ex. « Lire 20 min » → « Lire 30 min »). Chaque cran ajoute 150 à la difficulté.
- **Perte** : inactivité prolongée dans une catégorie → baisse légère (règle exacte à valider).
- **Calibrage de la difficulté** : v1 = estimée par le coach IA. v2 = recalibrée avec les données de la communauté (si 90 % réussissent, la difficulté baisse).
- Elo de départ par catégorie : 1000.

## 5. Coach IA
- Fournisseur : **API Gemini (version gratuite)**, déjà utilisée dans BEYND.
- La clé reste **côté backend**, dans `.env`, exclu par `.gitignore`. Jamais dans le frontend ni dans le repo.
- Appelé seulement à la création ou modification d'un objectif (pas à chaque tâche) → coût quasi nul.
- Sortie attendue en JSON :
```json
{
  "kind": "project",
  "category": "Tech",
  "difficulty": 1850,
  "steps": [
    { "title": "Pre Security", "tasks": ["Room How the Web Works", "Room Linux Fundamentals 1"] }
  ]
}
```
Pour une routine :
```json
{
  "kind": "routine",
  "category": "Sport",
  "difficulty": 1600,
  "habits": [{ "label": "Séance callisthénie (45 min)", "per_week": 3 }],
  "milestones": ["10 tractions strictes", "Pompe en équilibre contre le mur", "Premier muscle-up"],
  "boss_weeks": 8
}
```
- Le coach choisit le type. Un objectif du genre « tenir un rythme » (lecture, sport régulier, pratique d'une langue) devient une routine. Un objectif avec une fin claire et un parcours (certification, projet) reste un projet. L'utilisateur peut changer le type dans l'aperçu.

## 6. Périmètre
**MVP (v1, solo)**
- Création d'objectif + analyse par le coach (type, catégorie, difficulté, étapes et tâches, ou habitudes et jalons)
- Accueil : avatar + niveau/XP, Elo de vie + courbe, Elo par catégorie, Quête du jour, objectif principal
- Écran Objectifs : filtres par catégorie, difficulté + gain potentiel par objectif
- Écran Progrès : courbes d'Elo par catégorie, historique, séries
- Cocher une tâche ou une séance → XP + mise à jour Elo
- Routines : habitudes hebdomadaires, semaines tenues, jalons, boss = série de semaines
- Raid du dimanche, en solo : un monstre par semaine, chaque coche charge l'arme, l'assaut se lance le dimanche ; victoire = XP, trophée et accessoire pour l'avatar (jamais d'Elo)

**v2**
- Raids du dimanche entre potes (extension du raid solo) : un monstre commun avec des points de vie, chaque tâche cochée dans la semaine lui inflige des dégâts, l'équipe l'achève le dimanche
- Collection de petits monstres (un par domaine)
- Recalibrage communautaire des difficultés

## 7. Modèle de données (esquisse)
- `users` (id, nom, niveau, xp, série)
- `categories` (id, nom)
- `user_category_elo` (user_id, category_id, elo, historique)
- `goals` (id, user_id, category_id, titre, difficulté, statut)
- `steps` (id, goal_id, titre, ordre, statut)
- `tasks` (id, step_id, libellé, xp, date_prévue, fait_le)
- v2 : `raids`, `raid_members`, `monsters`

## 8. Direction graphique
- Fond `#1C1B19`, cartes `#262522`, bordures `#2E2D2A`
- Texte `#ECE9E2`, secondaire `#A9A499`, discret `#7C786F`
- Accent principal (vert) `#9BD15A` ; XP/or `#F2B24C` ; Élite/raid `#F08DAE` ; Moyen `#7FB4E8` ; baisse `#E8875A`
- Polices : **Archivo** (interface) + **Silkscreen** (labels pixel : niveau, XP, badges)
- Avatar et monstres en pixel art (SVG `shape-rendering="crispEdges"`)
- Mobile d'abord (390 px), navigation basse : Accueil · Objectifs · Progrès · Profil

## 9. Premier cas d'usage : cybersécurité offensive
Objectif « Devenir pentester (eJPT) », catégorie Tech, difficulté 1850, 1 à 2 h par jour :
1. Mois 1 — TryHackMe *Pre Security*, OverTheWire *Bandit* 0-20, bases Python/Bash
2. Mois 2 — TryHackMe *Cyber Security 101*
3. Mois 3-4 — TryHackMe *Jr Penetration Tester* + PortSwigger Academy
4. Mois 5 — Machines complètes (Vulnversity, Kenobi, Blue, Steel Mountain) puis HTB faciles
5. Mois 6 — Certification eJPT
