import React from 'react';

// Scrollable screen body with a title. Every tab renders inside one.
export function Screen({ title, action = null, children }) {
  return (
    <div className="screen">
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <h1 style={{ margin: 0, fontSize: 'var(--text-xl)', fontWeight: 800, letterSpacing: 'var(--tracking-tight)' }}>{title}</h1>
        {action}
      </header>
      {children}
    </div>
  );
}

export function Placeholder({ title, step, children }) {
  return (
    <Screen title={title}>
      <p style={{ color: 'var(--color-text-muted)', margin: 0 }}>{children}</p>
      <p style={{ color: 'var(--color-text-subtle)', margin: 0, fontSize: 'var(--text-xs)' }}>Arrive à l'étape {step}.</p>
    </Screen>
  );
}
