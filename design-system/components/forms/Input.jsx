import React from 'react';

export function Input({ placeholder = '', value, onChange, type = 'text', icon = null, disabled = false }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '8px',
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-md)',
      padding: '10px 14px',
      transition: 'border-color var(--duration-fast) var(--ease-standard)',
      opacity: disabled ? 0.5 : 1,
    }}>
      {icon}
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        onChange={onChange}
        style={{
          border: 'none', outline: 'none', background: 'transparent',
          font: 'inherit', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)',
          color: 'var(--color-text)', width: '100%',
        }}
      />
    </div>
  );
}

export function Textarea({ placeholder = '', value, onChange, rows = 3, disabled = false }) {
  return (
    <textarea
      placeholder={placeholder}
      value={value}
      rows={rows}
      disabled={disabled}
      onChange={onChange}
      style={{
        display: 'block', width: '100%', resize: 'vertical',
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        padding: '10px 14px',
        font: 'inherit', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)',
        color: 'var(--color-text)',
        opacity: disabled ? 0.5 : 1,
      }}
    />
  );
}
