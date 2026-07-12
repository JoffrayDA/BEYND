import React from 'react';

export function Button({
  variant = 'primary',
  size = 'md',
  disabled = false,
  icon = null,
  children,
  onClick,
  type = 'button',
}) {
  const pad = { sm: '8px 14px', md: '11px 18px', lg: '14px 24px' }[size];
  const fontSize = { sm: 'var(--text-sm)', md: 'var(--text-base)', lg: 'var(--text-md)' }[size];

  const base = {
    fontFamily: 'var(--font-sans)',
    fontWeight: 600,
    fontSize,
    padding: pad,
    borderRadius: 'var(--radius-pill)',
    border: '1px solid transparent',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.45 : 1,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    transition: 'transform var(--duration-fast) var(--ease-standard), background var(--duration-fast), border-color var(--duration-fast)',
    lineHeight: 1,
  };

  const variants = {
    primary: {
      background: 'var(--color-primary)',
      color: 'var(--color-text-on-primary)',
    },
    secondary: {
      background: 'transparent',
      color: 'var(--color-text)',
      borderColor: 'var(--color-border-strong)',
    },
    ghost: {
      background: 'transparent',
      color: 'var(--color-text-muted)',
    },
    accent: {
      background: 'var(--color-accent)',
      color: 'var(--color-text-on-accent)',
    },
  };

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      style={{ ...base, ...variants[variant] }}
      onMouseDown={(e) => { if (!disabled) e.currentTarget.style.transform = 'scale(0.97)'; }}
      onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
    >
      {icon}
      {children}
    </button>
  );
}
