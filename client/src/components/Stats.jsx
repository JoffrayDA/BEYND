import React from 'react';
import { Card } from '../ds.js';
import { fmtGain } from '../lib/home.js';

// Small uppercase pixel label (level, XP, badges, section kickers).
export function PixelLabel({ children, color = 'var(--color-text-muted)', style = {} }) {
  return (
    <span style={{
      fontFamily: 'var(--font-pixel)', fontSize: 10, letterSpacing: '0.04em',
      textTransform: 'uppercase', color, ...style,
    }}>{children}</span>
  );
}

export function StatTile({ label, value, sub, mark }) {
  return (
    <Card padding="12px" style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {mark && <span aria-hidden style={{ width: 8, height: 8, borderRadius: 2, background: mark, flex: 'none' }} />}
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', fontWeight: 600 }}>{label}</span>
      </div>
      <div style={{ fontWeight: 700, fontSize: 'var(--text-lg)' }}>{value}</div>
      {sub && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{sub}</div>}
    </Card>
  );
}

// Meter: fill = the given colour, unfilled track = a lighter step of the same
// hue, so the state reads across the whole bar.
export function Meter({ pct, color = 'var(--color-primary)', height = 8, label }) {
  const v = Math.max(0, Math.min(100, pct));
  return (
    <div
      role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100} aria-label={label}
      style={{
        height, borderRadius: 2, overflow: 'hidden',
        background: `color-mix(in srgb, ${color} 18%, var(--color-surface))`,
      }}
    >
      <div style={{ width: `${v}%`, height: '100%', background: color, transition: 'width var(--duration-slow) var(--ease-out)' }} />
    </div>
  );
}

// Signed daily change. Direction is carried by the arrow and the sign, not
// colour alone.
export function Delta({ value, suffix, small = false }) {
  const flat = Math.abs(value) < 0.05;
  const color = flat ? 'var(--color-text-subtle)' : value > 0 ? 'var(--color-up)' : 'var(--color-down)';
  return (
    <span style={{ color, fontWeight: 700, fontSize: small ? 'var(--text-xs)' : 'var(--text-sm)', whiteSpace: 'nowrap' }}>
      {flat ? '—' : `${value > 0 ? '▲' : '▼'} ${fmtGain(value)}`}
      {suffix && !flat && <span style={{ color: 'var(--color-text-muted)', fontWeight: 500 }}> {suffix}</span>}
    </span>
  );
}
