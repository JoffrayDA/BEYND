# Brief produit — App « Elo de vie » (nom provisoire)

## 1. Vision
Une app pour se dépasser : on pose ses objectifs de vie, on les découpe en tâches, on coche, et on voit sa progression. Pas de cours : le contenu vient d'ailleurs (TryHackMe, appli de langue, salle de sport…). L'app est la couche **motivation + suivi + coaching**.

Inspirations : **chess.com** (interface sombre et sérieuse, Elo, courbes, séries) × **Habitica** (pixel art, XP, quêtes, monstres). Le fun est en touches (avatar, monstres, célébrations), pas dans toute l'interface.

Différenciation : un **coach IA** construit le plan à partir d'un objectif, estime sa difficulté et l'ajuste selon ce que l'utilisateur fait vraiment. Habitica oblige à tout saisir soi-même.

## 2. Boucle centrale
1. L'utilisateur crée un objectif (ex. « Devenir pentester »).
2. Le coach l'analyse : catégorie, difficulté (rating), étapes, tâches.
3. Chaque jour, l'accueil affiche la « Quête du jour » (tâches à cocher).
4. Cocher une tâche → XP (niveau du personnage) + Elo de la catégorie.
5. La progression se voit : courbe d'Elo, séries de jours, étapes franchies, « boss final » (l'objectif).

## 3. Concepts
| Concept | Définition |
|---|---|
| Objectif | Ce qu'on veut atteindre. A une catégorie, une difficulté, des étapes. |
| Étape | Jalon d'un objectif (ex. « Pre Security »). |
| Tâche | Action concrète et cochable, rattachée à une étape. Donne de l'XP. |
| Catégorie | Tech, Langues, Sport, Carrière, Créatif… Chaque catégorie a **son propre Elo**. |
| Difficulté | Rating de l'objectif (400 → 2200). Paliers : Facile < 800, Moyen < 1400, Dur < 1800, Élite ≥ 1800. |
| XP / Niveau | Progression globale du personnage (avatar pixel). 1 000 XP par niveau. |
| Elo de vie | Moyenne des Elo de catégorie. |
| Série | Nombre de jours consécutifs avec au moins une tâche cochée. |

## 4. Règles d'équité (Elo)
Principe : comme aux échecs, on ne compare jamais deux catégories entre elles (Bullet ≠ Blitz), et un objectif au-dessus de son niveau rapporte plus qu'un objectif facile (comme les puzzles notés de chess.com).

- **Gain à la complétion d'une étape ou d'un objectif** :
  `gain = max(2, round((difficulté − Elo_catégorie) / 10 + 20))`
  Ex. italien (1900) avec Elo Langues 980 → +112. Ranger son bureau (450) avec Elo Carrière 1050 → +2.
- **Rendements décroissants** : une tâche identique répétée le même jour rapporte de moins en moins.
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
  "category": "Tech",
  "difficulty": 1850,
  "steps": [
    { "title": "Pre Security", "tasks": ["Room How the Web Works", "Room Linux Fundamentals 1"] }
  ]
}
```

## 6. Périmètre
**MVP (v1, solo)**
- Création d'objectif + analyse par le coach (catégorie, difficulté, étapes, tâches)
- Accueil : avatar + niveau/XP, Elo de vie + courbe, Elo par catégorie, Quête du jour, objectif principal
- Écran Objectifs : filtres par catégorie, difficulté + gain potentiel par objectif
- Écran Progrès : courbes d'Elo par catégorie, historique, séries
- Cocher une tâche → XP + mise à jour Elo

**v2**
- Raids du dimanche entre potes : un monstre commun avec des points de vie, chaque tâche cochée dans la semaine lui inflige des dégâts, l'équipe l'achève le dimanche
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
