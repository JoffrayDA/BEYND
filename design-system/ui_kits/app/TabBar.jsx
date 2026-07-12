function TabBar({ active, onChange }) {
  const tabs = [
    { id: 'chat', label: 'Chat' },
    { id: 'dashboard', label: 'Projet' },
    { id: 'history', label: 'Historique' },
    { id: 'coach', label: 'Coach' },
  ];
  return (
    <div style={{
      display: 'flex', borderTop: '1px solid var(--color-border)',
      background: 'var(--color-surface)', padding: '8px 4px',
    }}>
      {tabs.map((t) => (
        <button key={t.id} onClick={() => onChange(t.id)} style={{
          flex: 1, border: 'none', background: 'transparent', cursor: 'pointer',
          padding: '6px 0', fontSize: 'var(--text-xs)', fontWeight: 600,
          color: active === t.id ? 'var(--color-primary)' : 'var(--color-text-muted)',
        }}>{t.label}</button>
      ))}
    </div>
  );
}
