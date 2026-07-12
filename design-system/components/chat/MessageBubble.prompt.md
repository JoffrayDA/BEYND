Chat bubble — the core UI atom of BEYND (the whole app is a conversation).

```jsx
<MessageBubble from="coach" time="09:14">On fait le point sur cette semaine ?</MessageBubble>
<MessageBubble from="user" time="09:15">Ouais, pas ouf, j'ai loupé 2 séances.</MessageBubble>
```

`coach` bubbles use `--color-bubble-coach` (near-white/dark-surface depending on theme) with a border; `user` bubbles are filled `--color-bubble-user` (the coach's theme primary), no border. Tail corner is 4px, opposite corners follow `--radius-lg`.
