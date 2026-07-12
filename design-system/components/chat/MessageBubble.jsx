import React from 'react';

export function MessageBubble({ from = 'coach', children, time = '' }) {
  const isUser = from === 'user';
  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', marginBottom: 'var(--space-3)' }}>
      <div style={{
        maxWidth: '72%',
        background: isUser ? 'var(--color-bubble-user)' : 'var(--color-bubble-coach)',
        color: isUser ? 'var(--color-bubble-user-text)' : 'var(--color-bubble-coach-text)',
        border: isUser ? 'none' : '1px solid var(--color-border)',
        borderRadius: isUser ? 'var(--radius-lg) var(--radius-lg) 4px var(--radius-lg)' : 'var(--radius-lg) var(--radius-lg) var(--radius-lg) 4px',
        padding: '10px 16px',
        fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)', lineHeight: 'var(--leading-normal)',
        boxShadow: isUser ? 'none' : 'var(--shadow-xs)',
      }}>
        {children}
        {time && (
          <div style={{
            fontSize: '10px', marginTop: '4px', textAlign: 'right',
            opacity: 0.6, fontFamily: 'var(--font-mono)',
          }}>{time}</div>
        )}
      </div>
    </div>
  );
}
