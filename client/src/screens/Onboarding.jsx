import React, { useState } from 'react';
import { api } from '../api.js';
import { Button, Card, Avatar, MessageBubble, Input } from '../ds.js';

// P0 onboarding: pick coach -> short chat interview -> quick profile -> generate plan.
export function Onboarding({ state, onTheme, onDone }) {
  const [step, setStep] = useState('pick'); // pick | chat | profile
  const [messages, setMessages] = useState([]);
  const [coachId, setCoachId] = useState(null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const coachName = state.coaches.find((c) => c.id === coachId)?.name ?? '';
  const [profile, setProfile] = useState({ objectif: 'Perdre 5 kg', poids_depart: '', poids_cible: '', niveau: 'débutant', dispo_par_semaine: 3 });

  async function pickCoach(id) {
    setCoachId(id);
    onTheme(id);
    setBusy(true);
    try {
      const r = await api.onboardingStart(id);
      setMessages(r.messages);
      setStep('chat');
    } catch {
      setCoachId(null);
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    if (!input.trim() || busy) return;
    const text = input.trim();
    setInput('');
    setBusy(true);
    try {
      const r = await api.onboardingMessage(text);
      setMessages(r.messages);
    } catch {
      setInput(text);
    } finally {
      setBusy(false);
    }
  }

  async function complete() {
    setBusy(true);
    setError(null);
    try {
      await api.onboardingComplete({
        ...profile,
        poids_depart: Number(profile.poids_depart) || null,
        poids_cible: Number(profile.poids_cible) || null,
        dispo_par_semaine: Number(profile.dispo_par_semaine) || null,
      });
      await onDone();
    } catch {
      setError('La génération du plan a échoué. Réessaie.');
      setBusy(false);
    }
  }

  if (step === 'pick') {
    return (
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, justifyContent: 'center', flex: 1 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-3xl)', margin: 0 }}>BEYND</h1>
        <p style={{ color: 'var(--color-text-muted)', margin: 0 }}>Choisis ton coach pour démarrer.</p>
        {state.coaches.map((c) => (
          <Card key={c.id} style={{ cursor: 'pointer' }}>
            <div onClick={() => !busy && pickCoach(c.id)} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <Avatar name={c.name} size="lg" online />
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--text-lg)' }}>{c.name}</div>
                <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>{c.persona}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (step === 'chat') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar name={coachName} size="sm" online />
          <strong>Onboarding</strong>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {messages.map((m) => (
            <MessageBubble key={m.id} from={m.role === 'user' ? 'user' : 'coach'}>{m.contenu}</MessageBubble>
          ))}
          {busy && <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>…</div>}
        </div>
        <div style={{ padding: 12, display: 'flex', gap: 8, borderTop: '1px solid var(--color-border)' }}>
          <div style={{ flex: 1 }}>
            <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Réponds à ton coach…" />
          </div>
          <Button onClick={send} disabled={busy || !input.trim()}>↑</Button>
        </div>
        <div style={{ padding: 12, borderTop: '1px solid var(--color-border)' }}>
          <Button variant="secondary" onClick={() => setStep('profile')}>Générer mon plan →</Button>
        </div>
      </div>
    );
  }

  // profile
  const field = (label, key, type = 'text') => (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>{label}</span>
      <Input type={type} value={profile[key]} onChange={(e) => setProfile({ ...profile, [key]: e.target.value })} />
    </label>
  );
  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h2 style={{ fontFamily: 'var(--font-display)', margin: 0 }}>Ton objectif</h2>
      {field('Objectif', 'objectif')}
      {field('Poids actuel (kg)', 'poids_depart', 'number')}
      {field('Poids cible (kg)', 'poids_cible', 'number')}
      {field('Niveau', 'niveau')}
      {field('Séances / semaine', 'dispo_par_semaine', 'number')}
      {error && <p style={{ color: 'var(--color-danger)', margin: 0, fontSize: 'var(--text-sm)' }}>{error}</p>}
      <Button onClick={complete} disabled={busy}>{busy ? 'Génération…' : 'Générer mon programme'}</Button>
    </div>
  );
}
