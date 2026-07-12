const COACHES_INFO = [
  { id: 'cool-jeune', name: 'Max', tagline: 'Cool jeune — motivant, fun', swatch: '#C1440E' },
  { id: 'pote-cash', name: 'Sam', tagline: 'Pote cash — direct, sans filtre', swatch: '#155EEF' },
  { id: 'data-nerd', name: 'Nova', tagline: 'Data-Nerd — chiffres, tendances', swatch: '#00E5FF' },
];

function CoachSelectScreen({ active, onSelect }) {
  const { Avatar, Button } = window.BEYNDDesignSystem_ae2808;
  return (
    <div style={{ padding: 20, overflowY: 'auto', height: '100%' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--text-xl)', color: 'var(--color-text)', marginBottom: 4 }}>Choisis ton coach</div>
      <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginBottom: 18 }}>Tu peux changer à tout moment.</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {COACHES_INFO.map((c) => (
          <div key={c.id} onClick={() => onSelect(c.id)} style={{
            display: 'flex', alignItems: 'center', gap: 14, padding: 14,
            borderRadius: 'var(--radius-lg)', cursor: 'pointer',
            border: active === c.id ? `1.5px solid ${c.swatch}` : '1px solid var(--color-border)',
            background: 'var(--color-surface)',
          }}>
            <Avatar name={c.name} size="lg" />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--text-md)', color: 'var(--color-text)' }}>{c.name}</div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>{c.tagline}</div>
            </div>
            {active === c.id && <span style={{ width: 10, height: 10, borderRadius: '50%', background: c.swatch }} />}
          </div>
        ))}
      </div>
    </div>
  );
}
