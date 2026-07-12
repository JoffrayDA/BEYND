# BEYND — Design Decisions

Doc de référence pour la phase build. Résume les décisions prises 
en phase design (Claude Design). Le code exporté est dans 
`design-system/exported/`. Les visuels de référence sont dans 
`docs/design-refs/`.

## Positioning produit
Plateforme de coaching conversationnel où l'utilisateur choisit un 
coach (parmi 3 personas) qui l'accompagne sur un projet-objectif 
structuré. Interface principale = chat entre user et coach. 
MVP fitness, architecture pensée pour être extensible à d'autres 
domaines (langues, apprentissage, carrière) plus tard.

Différenciateur clé : chaque coach a sa personnalité ET son propre 
thème visuel qui se déclenche quand l'utilisateur le sélectionne.

## Les 3 coachs

### Nova — Data-Nerd
Scientifique analytique. Chiffres, tendances, décide sur la data.
- Voix : concise, factuelle, pas de flatterie
- Tagline : "Les chiffres ne mentent pas. Analysons-les ensemble."
- Thème : dark mode + accents néons cyan
- Ambiance : Linear / Vercel dashboard / late-night data

### Max — Cool Jeune
Influenceur fit fun, motivant sans être hardcore.
- Voix : chaleureuse, énergique, décontractée
- Tagline : "On y va tranquille mais on y va sérieux."
- Thème : crème / off-white + accents chauds (orange brûlé, moutarde)
- Ambiance : Nintendo Switch / warm nostalgic

### Sam — Pote Cash
Le meilleur pote qui te dit les vraies choses sans filtre.
- Voix : directe, no-BS, humaine
- Tagline : "Pas de bullshit. Tu bosses ou tu bosses pas."
- Thème : blanc clean + couleurs qui pop (bleu vif, rouge, vert)
- Ambiance : Notion / Linear light mode

## Design tokens (sémantiques)

Le design system utilise des tokens sémantiques qui swap selon 
le coach sélectionné :
- `--color-primary` (accent principal du coach)
- `--color-bg` (fond de l'app)
- `--color-surface` (cards, containers)
- `--color-surface-raised` (élévation, highlights)
- `--color-text` / `--color-text-muted`
- `--color-border`
- `--radius-pill` (boutons toujours pill, jamais carrés)
- `--radius-md` (16-20px, cards)
- `--shadow-xs` / `--shadow-md`

## Typographie
Sans-serif moderne unique pour toute l'app (Inter Tight, Söhne, 
Geist ou équivalent). Pas de mélange de polices. Tabular-nums 
pour les valeurs métriques.

## Style visuel des avatars
- Mockup actuel : disque avec gradient/glow ring cyan (fallback)
- Cible V1 : avatars 3D stylisés modernes (style Memoji adulte / 
  portrait Riot Games / Pixar-lite)
- À produire : Midjourney, Ready Player Me, ou illustrateur 
  commissionné
- Idéalement : plusieurs expressions par coach (satisfait, sérieux, 
  blasé) pour donner vie au chat

## Composants clés

### Button
Toujours pill-shaped (`--radius-pill`). Variants : `primary`, 
`secondary`, `ghost`, `accent`. Sizes : `sm`, `md`, `lg`.

### Card
Border-radius 20px, border 1px cyan (rgba 0.15), 
backdrop-blur pour effet frosted, shadow-xs par défaut. 
Variant `raised` pour élévation.

### MessageBubble (conversation)
PAS de style Messenger (bulles droite/gauche). Style ChatGPT/Claude :
- Messages coach : petit avatar rond à gauche, border-left cyan 
  gradient 2-3px, texte breathable
- Messages user : subtil, indenté, italique optionnel, muted color 
  (feels like "inner voice")
- Data cards inline quand le coach envoie des stats

### Avatar
Disque avec gradient/glow ring, tailles : 
- Hero : ~100px, glow prominent
- Mini (conv) : ~36px, glow subtil

## UI générale
- Fond dark avec léger gradient vertical, pas pur noir
- Grain/noise subtil (2-4% opacity)
- Cards en frosted glass, jamais aplats
- Neon accents avec glow subtil (pas gaming glow, premium neon signage)
- Data-forward : sparklines dans les cards métriques, deltas colorés
- Elements gaming (XP, badges) présents mais discrets

## À éviter absolument
- Pastel wellness (mauve, rose, self-care corporate)
- Warrior/hardcore (rouge/noir, flammes, beast mode)
- Pixel art / rétro gaming
- Illustrations enfantines, mascottes animales
- UI Tailwind défaut générique
- Bulles Messenger droite/gauche
- Sur-gamification style Habitica
- Mixed typography (mono + serif + sans dans le même écran)