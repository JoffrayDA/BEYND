function ChatScreen({ theme, messages, input, setInput, onSend }) {
  const bottomRef = React.useRef(null);
  React.useEffect(() => { bottomRef.current && bottomRef.current.scrollIntoView({ block: 'nearest' }); }, [messages.length]);
  const { MessageBubble, Badge } = window.BEYNDDesignSystem_ae2808;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        <div style={{ textAlign: 'center', marginBottom: 14 }}>
          <Badge tone="neutral">Semaine 4 · Perte de poids</Badge>
        </div>
        {messages.map((m, i) => (
          <MessageBubble key={i} from={m.from} time={m.time}>{m.text}</MessageBubble>
        ))}
        <div ref={bottomRef} />
      </div>
      <div style={{ display: 'flex', gap: 8, padding: '12px 16px', borderTop: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && input.trim()) onSend(); }}
          placeholder="Écris à ton coach…"
          style={{
            flex: 1, border: '1px solid var(--color-border)', borderRadius: 'var(--radius-pill)',
            padding: '11px 16px', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)',
            outline: 'none', background: 'var(--color-bg-subtle)', color: 'var(--color-text)',
          }}
        />
        <button
          onClick={onSend}
          disabled={!input.trim()}
          style={{
            border: 'none', borderRadius: '50%', width: 44, height: 44, flexShrink: 0,
            background: 'var(--color-primary)', color: 'var(--color-text-on-primary)',
            fontWeight: 700, cursor: input.trim() ? 'pointer' : 'not-allowed',
            opacity: input.trim() ? 1 : 0.45,
          }}
        >↑</button>
      </div>
    </div>
  );
}
