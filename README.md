# BEYND

Tes objectifs de vie, un Elo par catégorie. Tu décris un objectif, un coach IA
(Gemini) estime sa difficulté et le découpe en étapes et en tâches (projet) ou
en habitudes hebdomadaires (routine). Chaque coche fait monter l'Elo de la
catégorie ; ton **Elo de vie** est la moyenne de tes catégories.

- Produit : [`docs/BRIEF.md`](docs/BRIEF.md)
- Architecture : [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- Design system : [`design-system/`](design-system/)
- Ancienne version fitness : [`docs/archive/`](docs/archive/)

## Stack

- **client/** : PWA React 18 + Vite, mobile d'abord.
- **server/** : Hono sur Node ≥ 22, SQLite via `node:sqlite` (aucune dépendance native), Gemini par function calling.

## Lancer en local

Deux terminaux :

```bash
# 1. serveur (port 8787)
cd server
cp .env.example .env      # GEMINI_API_KEY optionnelle, voir plus bas
npm install
npm start                 # ou npm run dev pour le rechargement auto

# 2. client (port 5173, /api est relayé vers 8787)
cd client
npm install
npm run dev
```

Ouvre http://localhost:5173.

### Sur ton téléphone (même Wi-Fi)

Lance `npm run lan` dans `client/` à la place de `npm run dev`. Vite affiche une
ligne `Network: http://192.168.x.x:5173/` : ouvre cette adresse sur le
téléphone. Au premier lancement, Windows peut demander d'autoriser Node.js sur
les réseaux privés : accepte. En HTTP local, l'app marche mais ne s'installe
pas comme appli (il faut HTTPS, voir le déploiement).

## Variables (`server/.env`)

| Variable | Rôle |
|---|---|
| `GEMINI_API_KEY` | Clé Gemini (aistudio.google.com/apikey). Sans clé : **mode simulé**, le coach renvoie des plans d'exemple et tout le parcours reste jouable. |
| `GEMINI_MODEL` | Modèle, `gemini-3.8-flash` par défaut. |
| `APP_PASSWORD` | Active l'écran de connexion (session de 30 jours par cookie). Vide : pas de mot de passe. **Obligatoire si l'app est en ligne.** |
| `SESSION_SECRET` | Secret des cookies (optionnel, sinon dérivé du mot de passe). |
| `DAY_START_HOUR` | Heure de début de la journée de jeu (4 par défaut). |
| `PORT` | Port du serveur (8787). |
| `ELO_DB_PATH` | Fichier SQLite (par défaut `server/elo.db`). |

La clé Gemini ne quitte jamais le serveur.

## Commandes utiles

| Où | Commande | Effet |
|---|---|---|
| `server/` | `npm test` | Tests serveur (mode simulé, aucun appel Gemini) |
| `client/` | `npm test` | Tests de la logique client |
| `server/` | `npm run mock` | Serveur sans charger `.env` (donc sans Gemini ni mot de passe) |
| `server/` | `npm run demo:xp` | Amène l'XP à 5 points du niveau suivant, pour voir la célébration à la prochaine coche |
| `client/` | `npm run build` | Construit la PWA dans `client/dist/` ; `npm start` dans `server/` la sert alors aussi sur :8787 |
| `client/` | `npm run icons` | Régénère les icônes PWA |
