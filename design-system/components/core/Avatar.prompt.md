Round avatar — coach portrait (3D stylized, Memoji-adult style) or user initials fallback.

```jsx
<Avatar src="/assets/coach-max.png" name="Max" size="lg" online />
<Avatar name="Julie D." size="md" />
```

Always circular (`--radius-avatar`), 2px surface-color ring + soft shadow so it pops off any bubble/list background. No `src` falls back to display-font initials in primary color. `online` shows a small success-color dot, bottom-right.
