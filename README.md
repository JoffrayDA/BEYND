# BEYND

> En cours de pivot (branche `feat/elo-mvp`) vers « Elo de vie » : objectifs de vie,
> Elo par catégorie, coach IA qui construit le plan. Le code ci-dessous est encore
> la version fitness ; docs fitness dans [`docs/archive/`](docs/archive/).

- Produit : [`docs/BRIEF.md`](docs/BRIEF.md)
- Architecture : [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- Design system : [`design-system/`](design-system/) (tokens CSS + composants React)

## Stack

- **client/** — PWA React + Vite (mobile-first). Consomme le design-system.
- **server/** — Hono + `node:sqlite` (zéro dep native) + Gemini API.

## Lancer en dev

Deux terminaux :

```bash
# 1. serveur (port 8787)
cd server
cp .env.example .env      # renseigner GEMINI_API_KEY (optionnel)
npm install
npm run dev

# 2. client (port 5173, proxy /api -> 8787)
cd client
npm install
npm run dev
```

Ouvre http://localhost:5173.

**Sans clé API** : l'app tourne en *mock mode* (réponses coach factices, plan par
défaut) — tout le flux est jouable. **Avec** `GEMINI_API_KEY` dans `server/.env` :
vraies réponses coach + génération de programme par le LLM (`gemini-2.5-flash`).

## Statut

P0 livré : onboarding conversationnel → génération de plan → chat (métriques en
tête) → log poids + checklist engagements → switch de coach.
P1 à venir : dashboard, historique, réglages, check-ins d'ouverture.
