import React from 'react';

export function Badge({ children, tone = 'neutral' }) {
  const tones = {
    neutral: { background: 'var(--color-bg-subtle)', color: 'var(--color-text-muted)' },
    primary: { background: 'var(--color-primary)', color: 'var(--color-text-on-primary)' },
    accent: { background: 'var(--color-accent)', color: 'var(--color-text-on-accent)' },
    success: { background: 'var(--color-success)', color: '#fff' },
  };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', fontWeight: 700,
      letterSpacing: 'var(--tracking-wide)', textTransform: 'uppercase',
      padding: '4px 10px', borderRadius: 'var(--radius-pill)',
      ...tones[tone],
    }}>
      {children}
    </span>
  );
}

export function XPPill({ xp = 0, level = 1 }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: '6px',
      background: 'var(--color-bg-subtle)', border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-pill)', padding: '5px 12px 5px 6px',
      fontFamily: 'var(--font-sans)',
    }}>
      <span style={{
        background: 'var(--color-accent)', color: 'var(--color-text-on-accent)',
        borderRadius: '50%', width: 20, height: 20, fontSize: 11, fontWeight: 800,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>{level}</span>
      <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-text)' }}>{xp} XP</span>
    </div>
  );
}
