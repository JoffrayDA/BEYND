import React from 'react';

const SIZES = { sm: 32, md: 48, lg: 72, xl: 112 };

export function Avatar({ src, name = '', size = 'md', online = false }) {
  const px = SIZES[size] || SIZES.md;
  const initials = name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div style={{ position: 'relative', width: px, height: px, flexShrink: 0 }}>
      <div style={{
        width: px, height: px, borderRadius: 'var(--radius-avatar)',
        overflow: 'hidden', background: 'var(--color-bg-subtle)',
        border: '2px solid var(--color-surface)',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {src
          ? <img src={src} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--color-primary)', fontSize: px * 0.36 }}>{initials}</span>}
      </div>
      {online && (
        <span style={{
          position: 'absolute', bottom: 0, right: 0,
          width: px * 0.26, height: px * 0.26, minWidth: 10, minHeight: 10,
          borderRadius: '50%', background: 'var(--color-success)',
          border: '2px solid var(--color-surface)',
        }} />
      )}
    </div>
  );
}
