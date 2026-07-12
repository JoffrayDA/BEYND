import React from 'react';

export function Card({ padding = 'var(--space-5)', raised = false, children, style = {} }) {
  return (
    <div style={{
      background: raised ? 'var(--color-surface-raised)' : 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-lg)',
      boxShadow: raised ? 'var(--shadow-md)' : 'var(--shadow-xs)',
      padding,
      ...style,
    }}>
      {children}
    </div>
  );
}
