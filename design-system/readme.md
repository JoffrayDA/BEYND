# BEYND Design System

BEYND is a conversational coaching app: users pick one of 3 coach personas,
each with a distinct personality and a distinct visual theme, and work
through a structured project-goal (MVP: weight loss / fitness) primarily
through **chat**. The coach holds the user accountable, challenges, adjusts,
motivates. The architecture is built to later host other project types
(languages, learning, career) without a redesign.

Positioning: between Whoop (data-driven, serious) and a real human coach
(personality, character) — accessible, modern, conversational accountability
rather than gamification-first.

**Source material:** this design system was generated from a written product
brief only (see the brief pasted into this project's chat) — no Figma file,
codebase, or existing brand assets were attached. Every visual decision below
was authored from that brief; there is no external source of truth to
cross-check against. If a Figma link, codebase, or brand assets exist, attach
them and this system should be revised against them.

## The 3 coaches

| Coach | Persona | Theme |
|---|---|---|
| Max — "Cool jeune" | Fit influencer, fun, motivating, not hardcore | Cream/off-white + burnt orange, mustard, brick |
| Sam — "Pote cash" | Blunt best friend, tells you the truth | Clean white, Notion/Linear light, vivid blue/red/green |
| Nova — "Data-Nerd" | Analytical scientist, numbers-driven | Dark mode, neon cyan/magenta/acid-green |

Themes are applied via `data-theme="cool-jeune" | "pote-cash" | "data-nerd"`
(default = cool-jeune) driving semantic tokens in `tokens/colors.css` — see
`components/navigation/CoachThemeSwitcher.jsx`.

## Components

Core:
- **Button** (`components/core/Button.jsx`) — pill button, primary/secondary/ghost/accent
- **Card** (`components/core/Card.jsx`) — surface container, default/raised
- **Avatar** (`components/core/Avatar.jsx`) — round avatar, coach portrait or initials
- **Badge / XPPill** (`components/core/Badge.jsx`) — status label + discreet level/XP pill

Forms:
- **Input / Textarea** (`components/forms/Input.jsx`)

Chat:
- **MessageBubble** (`components/chat/MessageBubble.jsx`) — user vs coach bubble

Navigation:
- **CoachThemeSwitcher** (`components/navigation/CoachThemeSwitcher.jsx`)

### Intentional additions
No source component library was provided, so this is a from-scratch standard
set sized to the brief (chat-first, accountability app): Button, Input,
Textarea, Card, Avatar, Badge, XPPill, MessageBubble, CoachThemeSwitcher.
`CoachThemeSwitcher` specifically exists because the brief requires
user-facing switching between the 3 coach themes — there's no equivalent in
a typical component library.

## Fonts — flagged substitution
No font files were provided. Per the brief's own suggestion ("Inter, Söhne,
GT America ou similar") **Inter** is used for UI/body text, loaded from
Google Fonts CDN (`tokens/fonts.css`). For "character" display moments
(coach names, achievements, headers) **Bricolage Grotesque** was chosen as a
distinct, modern display face — also Google Fonts. **Please supply real
brand font files if BEYND has licensed faces (e.g. actual Söhne/GT America)
and this system will be updated.**

## Index
- `styles.css` — root stylesheet, `@import`s everything below
- `tokens/colors.css` — base palette + 3 theme scopes + semantic aliases
- `tokens/typography.css` — font families, type scale, weights
- `tokens/spacing.css` — spacing/radius/shadow/motion scale
- `tokens/fonts.css` — Google Fonts CDN import (Inter, Bricolage Grotesque)
- `guidelines/*.card.html` — foundation specimen cards (Colors, Type, Spacing, Brand)
- `components/core/` — Button, Card, Avatar, Badge, XPPill
- `components/forms/` — Input, Textarea
- `components/chat/` — MessageBubble
- `components/navigation/` — CoachThemeSwitcher
- `ui_kits/app/` — chat home screen recreation (BEYND mobile app)
- `assets/` — image-slot component (no logo/imagery source was provided — see Iconography)
- `SKILL.md` — portable skill file for Claude Code

---

## CONTENT FUNDAMENTALS

Tone is **accountability with warmth, not wellness-fluffy and not drill-sergeant**.
The coach speaks like a real person who is invested in the user's result —
direct, warm, occasionally teasing, never clinical.

- **Address:** "tu" (informal French), always. Never vouvoiement — the coach
  is a peer/friend figure, not an institution.
- **Casing:** sentence case everywhere. No ALL-CAPS shouting except tiny
  eyebrow labels (e.g. "EYEBROW LABEL", 12px, letter-spaced) which are a UI
  convention, not a voice choice.
- **Punctuation as personality:** each coach's voice shifts the same content:
  - Max (cool jeune): "On y retourne demain, t'inquiète 💪" — energetic,
    exclamation-light, never over-punctuated.
  - Sam (pote cash): "T'as loupé 2 séances. On fait quoi." — short, blunt,
    declarative, minimal softening.
  - Nova (data-nerd): "Ta variance de poids est repassée sous 0.3kg/jour."
    — precise, numbers-first, still addressed to "tu" not clinical third-person.
- **Emoji:** used sparingly, and only by Max (cool jeune persona) — never by
  Sam or Nova. Never emoji in UI chrome (buttons, labels, nav) — only inside
  chat message content, and only where it matches that coach's voice.
- **Vibe:** short sentences. Real talk, not therapy-speak. Never "self-care",
  "journey", "wellness" — the brief explicitly rejects pastel-wellness tone.
  Never hardcore/military language ("beast mode", "no excuses") either — the
  brief rejects warrior tone just as firmly. The tone lives in the middle:
  a good friend who happens to be a coach.
- **Numbers over adjectives:** progress is stated as data ("-4.2kg in 6
  weeks") more often than praise adjectives — data-forward per the Whoop
  influence, even in Max's and Sam's copy, just wrapped in warmer phrasing.

## VISUAL FOUNDATIONS

- **Color:** three fully distinct semantic-token themes (see table above),
  swapped via `[data-theme]`. No theme mixes warm-cream with neon — each
  theme is internally coherent. Semantic status colors (danger/warning/success)
  stay constant across all 3 themes so meaning doesn't shift with persona.
- **Type:** Inter for all UI/body/data text; Bricolage Grotesque reserved for
  "character" moments only — coach names, achievement headers, big display
  numbers. Never use the display face for body paragraphs or buttons.
- **Backgrounds:** flat solid semantic-token colors only. No gradients, no
  hand-drawn illustration, no repeating pattern/texture. The one deliberate
  "image" surface is the round coach avatar — everything else stays flat and
  typographic. This keeps the UI feeling like Whoop/Linear, not a lifestyle app.
- **Animation:** quick and confident, never bouncy/springy (bounce reads as
  "gaming", which the brief rejects). `--duration-fast` (120ms) for
  micro-interactions (button press), `--duration-base` (200ms) for
  theme/surface transitions, `cubic-bezier` standard/out eases — no elastic
  or overshoot curves.
- **Hover states:** darken filled surfaces one step (`--color-primary-hover`),
  no opacity fades on filled buttons (opacity fade is reserved for
  disabled state only).
- **Press states:** scale down slightly (~0.97) + a darker `-press` token
  variant — no color-only press feedback, the scale gives it tactile weight
  without becoming springy.
- **Borders:** 1px, `--color-border` (neutral, theme-tinted), used on cards,
  inputs, and coach (secondary) message bubbles. User message bubbles have no
  border — they're filled with the theme primary color instead, which is
  enough visual weight on its own.
- **Shadows:** soft and low-opacity (`--shadow-xs/sm/md/lg`), warm-neutral
  tint in light themes; in the dark Data-Nerd theme, shadows lean on darker
  opacity rather than glow — glow is reserved for the `--shadow-glow-primary`
  token, used sparingly (e.g. an active/selected state), not on every card.
- **Corner radii:** soft-modern, never sharp, never full-pill-everything.
  8px small controls, 14px inputs/small cards, 20px cards, 28px large
  surfaces/sheets, full pill only for buttons, badges, avatars, and the
  coach switcher.
- **Cards:** 1px border + `--radius-lg` (20px) + near-flat shadow by default;
  a `raised` variant bumps to `--shadow-md` on a slightly lighter/darker
  "raised" surface token for callouts (e.g. a highlighted metric).
- **Transparency/blur:** none in this v1 — every surface is opaque. No
  frosted-glass panels, no blurred overlay chrome. (An `--color-overlay`
  token exists for modal scrims only.)
- **Imagery:** the only imagery in the system is the coach avatar itself —
  3D stylized (Memoji-adult / Pixar-lite / Riot-portrait register), warm
  and expressive rather than photographic. No stock photography, no
  lifestyle imagery anywhere else in the UI.
- **Layout:** chat is the fixed, primary surface — composer pinned to the
  bottom, coach header pinned to the top, message history scrolls between.
  Secondary screens (dashboard, history, coach switch) are reached via a
  bottom tab bar so chat is always one tap away.
- **Gamification:** present but deliberately quiet — a small level-number
  dot + "N XP" text (`XPPill`), never a full progress bar, quest log, or
  badge wall front-and-center. It sits in a header corner, not the hero of
  any screen.

## ICONOGRAPHY

No icon font, sprite sheet, or SVG set was provided with the brief. **Lucide
icons** (CDN: `https://unpkg.com/lucide@latest`) are used as the substitute —
flagged here as a substitution, not a source-verified choice. Lucide was
picked for its clean single-weight stroke that matches the
Notion/Linear-adjacent, modern-clean register the brief calls for (fits all
3 themes without needing per-theme icon variants — stroke color inherits
`currentColor`). No emoji are used in chrome/icons — emoji only ever appear
inside Max's chat messages (see Content Fundamentals). No unicode
glyphs-as-icons. If BEYND has its own icon set, replace the Lucide CDN
reference in the UI kit and flag any icon whose meaning doesn't map cleanly.

## Fonts — see "Fonts — flagged substitution" above.
