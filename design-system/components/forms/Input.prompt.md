Surface-bound text field for forms and settings (not the chat composer — see MessageComposer).

```jsx
<Input placeholder="Ton objectif" value={goal} onChange={(e) => setGoal(e.target.value)} />
<Textarea placeholder="Comment s'est passée ta semaine ?" rows={4} />
```

14px radius, 1px neutral border, no shadow. Border does not change on focus color-wise in this simplified kit; production should add a `--color-primary` focus ring.
