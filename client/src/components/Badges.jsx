import React from 'react';

// Category identity: a coloured square beside the name. The text stays in
// text tokens — the colour lives on the mark only.
export function CategoryTag({ id, name, muted = false }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      fontSize: 'var(--text-xs)', fontWeight: 600,
      color: muted ? 'var(--color-text-muted)' : 'var(--color-text)',
    }}>
      <span aria-hidden style={{ width: 8, height: 8, borderRadius: 2, background: `var(--cat-${id})`, flex: 'none' }} />
      {name}
    </span>
  );
}

// Difficulty tier + rating, pixel font (brief: badges use Silkscreen).
export function TierBadge({ tier, difficulty }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      fontFamily: 'var(--font-pixel)', fontSize: 10, letterSpacing: '0.04em', textTransform: 'uppercase',
      padding: '3px 6px', borderRadius: 4,
      background: `var(--tier-${tier.id})`, color: 'var(--color-text-on-primary)',
    }}>
      {tier.label}{difficulty != null && <span style={{ opacity: 0.75 }}>{difficulty}</span>}
    </span>
  );
}
