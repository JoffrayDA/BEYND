import React, { useState, useRef, useEffect } from 'react';
import { api } from '../api.js';
import { Avatar, MessageBubble, Input, Button, CoachThemeSwitcher } from '../ds.js';

function Metric({ label, value }) {
  return (
    <div style={{ flex: 1, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '10px 12px' }}>
      <div style={{ fontSize: 10, letterSpacing: 'var(--tracking-wide)', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 700 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--text-lg)', color: 'var(--color-primary)', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  );
}

export function Chat({ state, refresh, onTheme }) {
  const [messages, setMessages] = useState(state.messages);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [showSwitch, setShowSwitch] = useState(false);
  const bottom = useRef(null);
  const m = state.metrics || {};

  useEffect(() => { bottom.current?.scrollIntoView({ block: 'nearest' }); }, [messages.length]);

  async function send() {
    if (!input.trim() || busy) return;
    const text = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { id: `tmp-${Date.now()}`, role: 'user', contenu: text }]);
    setBusy(true);
    const r = await api.chat(text);
    setMessages(r.messages);
    setBusy(false);
  }

  async function switchCoach(id) {
    setBusy(true);
    onTheme(id);
    const r = await api.switchCoach(id);
    setMessages(r.messages);
    setShowSwitch(false);
    setBusy(false);
    refresh();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <Avatar name={state.project.coach_id} size="sm" online />
          <strong style={{ flex: 1 }}>{state.project.objectif || 'Mon projet'}</strong>
          <Button size="sm" variant="ghost" onClick={() => setShowSwitch((v) => !v)}>Coach ⌄</Button>
        </div>
        {showSwitch && (
          <div style={{ marginBottom: 10, overflowX: 'auto' }}>
            <CoachThemeSwitcher active={state.project.coach_id} onChange={switchCoach} />
          </div>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <Metric label="Poids actuel" value={m.actuel != null ? `${m.actuel} kg` : '—'} />
          <Metric label="Tendance 7j" value={`${m.tendance7 > 0 ? '+' : ''}${m.tendance7 ?? 0} kg`} />
          <Metric label="Adhérence" value={`${m.adherence ?? 0}%`} />
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {messages.map((msg) => (
          <MessageBubble key={msg.id} from={msg.role === 'user' ? 'user' : 'coach'}>{msg.contenu}</MessageBubble>
        ))}
        {busy && <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>…</div>}
        <div ref={bottom} />
      </div>

      <div style={{ padding: 12, display: 'flex', gap: 8, borderTop: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
        <div style={{ flex: 1 }} onKeyDown={(e) => { if (e.key === 'Enter') send(); }}>
          <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Écris à ton coach…" />
        </div>
        <Button onClick={send} disabled={busy || !input.trim()}>↑</Button>
      </div>
    </div>
  );
}
