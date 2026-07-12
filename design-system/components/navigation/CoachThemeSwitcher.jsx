import React from 'react';

const COACHES = [
  { id: 'cool-jeune', name: 'Max', tagline: 'Cool jeune' },
  { id: 'pote-cash', name: 'Sam', tagline: 'Pote cash' },
  { id: 'data-nerd', name: 'Nova', tagline: 'Data-Nerd' },
];

export function CoachThemeSwitcher({ active = 'cool-jeune', onChange }) {
  return (
    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
      {COACHES.map((c) => {
        const isActive = c.id === active;
        return (
          <button
            key={c.id}
            onClick={() => onChange && onChange(c.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '8px 14px', borderRadius: 'var(--radius-pill)',
              border: isActive ? '1.5px solid var(--color-primary)' : '1px solid var(--color-border)',
              background: isActive ? 'var(--color-bg-subtle)' : 'transparent',
              cursor: 'pointer', fontFamily: 'var(--font-sans)',
            }}
          >
            <span style={{
              width: 10, height: 10, borderRadius: '50%',
              background: { 'cool-jeune': '#C1440E', 'pote-cash': '#155EEF', 'data-nerd': '#00E5FF' }[c.id],
            }} />
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text)' }}>{c.name}</span>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{c.tagline}</span>
          </button>
        );
      })}
    </div>
  );
}
