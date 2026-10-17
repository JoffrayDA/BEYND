import React from 'react';

// App name as a plain type mark (no logo asset yet, see design-system).
export function Wordmark({ size = 28, sub = null }) {
  return (
    <div>
      <div style={{ fontWeight: 800, fontSize: size, letterSpacing: '-0.03em', lineHeight: 1 }}>BEYND</div>
      {sub && <div style={{ marginTop: 4, color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>{sub}</div>}
    </div>
  );
}
