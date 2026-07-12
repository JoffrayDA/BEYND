Segmented control to switch active coach — driving `data-theme` on the app root.

```jsx
<CoachThemeSwitcher active="pote-cash" onChange={(id) => setTheme(id)} />
```

Intentional addition (see readme.md): not from a source component library, added because the brief requires user-facing switching between the 3 coach themes.
