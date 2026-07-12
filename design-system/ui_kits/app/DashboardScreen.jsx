function DashboardScreen() {
  const { Card, XPPill, Badge } = window.BEYNDDesignSystem_ae2808;
  const points = [82, 81.6, 81.2, 80.5, 80.1, 79.4, 78.9, 78.4];
  const max = Math.max(...points), min = Math.min(...points);
  const w = 280, h = 90;
  const path = points.map((p, i) => {
    const x = (i / (points.length - 1)) * w;
    const y = h - ((p - min) / (max - min || 1)) * h;
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  return (
    <div style={{ padding: 16, overflowY: 'auto', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--text-lg)', color: 'var(--color-text)' }}>Perte de poids</div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>Objectif : 75kg · S4/12</div>
        </div>
        <XPPill xp={240} level={3} />
      </div>

      <Card raised style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-3xl)', fontWeight: 600, color: 'var(--color-primary)' }}>78.4</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>kg · −3.6 en 4 sem</span>
        </div>
        <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: 'block' }}>
          <path d={path} fill="none" stroke="var(--color-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Card>

      <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
        <Card style={{ flex: 1 }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 4 }}>Séances/sem</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xl)', fontWeight: 600, color: 'var(--color-text)' }}>4/5</div>
        </Card>
        <Card style={{ flex: 1 }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 4 }}>Streak</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xl)', fontWeight: 600, color: 'var(--color-text)' }}>12j</div>
        </Card>
      </div>

      <Card>
        <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 8, color: 'var(--color-text)' }}>Check-ins récents</div>
        {['Lun 6/07 — séance jambes ✓', 'Mer 8/07 — séance manquée', 'Ven 10/07 — séance haut du corps ✓'].map((t, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderTop: i > 0 ? '1px solid var(--color-border)' : 'none' }}>
            <Badge tone={t.includes('manquée') ? 'neutral' : 'success'}>{t.includes('manquée') ? 'raté' : 'fait'}</Badge>
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text)' }}>{t.replace(' ✓', '').replace('— séance manquée', '— séance')}</span>
          </div>
        ))}
      </Card>
    </div>
  );
}
