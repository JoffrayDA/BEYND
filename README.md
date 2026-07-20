# BEYND

Plateforme de coaching conversationnel. MVP fitness (perte de poids), chat-first,
3 coachs (Max / Sam / Nova) avec thème visuel par coach.

- Produit : [`docs/PRD.md`](docs/PRD.md)
- Architecture : [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- Design system : [`design-system/`](design-system/) (tokens CSS + composants React)

## Stack

- **client/** — PWA React + Vite (mobile-first). Consomme le design-system.
- **server/** — Hono + `node:sqlite` (zéro dep native) + Claude API.

## Lancer en dev

Deux terminaux :

```bash
# 1. serveur (port 8787)
cd server
cp .env.example .env      # renseigner ANTHROPIC_API_KEY (optionnel)
npm install
npm run dev

# 2. client (port 5173, proxy /api -> 8787)
cd client
npm install
npm run dev
```

Ouvre http://localhost:5173.

**Sans clé API** : l'app tourne en *mock mode* (réponses coach factices, plan par
défaut) — tout le flux est jouable. **Avec** `ANTHROPIC_API_KEY` dans `server/.env` :
vraies réponses coach + génération de programme par le LLM (`claude-sonnet-5`).

## Statut

P0 livré : onboarding conversationnel → génération de plan → chat (métriques en
tête) → log poids + checklist engagements → switch de coach.
P1 à venir : dashboard, historique, réglages, check-ins d'ouverture.
