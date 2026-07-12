function CoachHeader({ name, tagline, avatarInitials, onOpenDashboard }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '14px 16px', borderBottom: '1px solid var(--color-border)',
      background: 'var(--color-surface)',
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: '50%', background: 'var(--color-bg-subtle)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--color-primary)',
      }}>{avatarInitials}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--text-md)', color: 'var(--color-text)' }}>{name}</div>
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{tagline}</div>
      </div>
      <button onClick={onOpenDashboard} style={{
        border: '1px solid var(--color-border)', background: 'transparent', borderRadius: 'var(--radius-pill)',
        padding: '7px 14px', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-text)', cursor: 'pointer',
      }}>Projet</button>
    </div>
  );
}
