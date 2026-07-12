Pill-shaped action button; the base interactive control across BEYND surfaces.

```jsx
<Button variant="primary" size="md" onClick={() => {}}>Envoyer</Button>
<Button variant="secondary">Annuler</Button>
<Button variant="accent" icon={<Flame size={16} />}>Relancer le défi</Button>
```

Variants: `primary` (filled, brand color — main CTA), `secondary` (outline, on surfaces), `ghost` (text-only, low emphasis), `accent` (filled accent color, for a single highlighted action per screen). Sizes: `sm | md | lg`. Always pill radius (`--radius-pill`) — BEYND never uses square/rounded buttons.
