import React, { useState } from 'react';
import { api } from '../api.js';
import { Button, Card, Input, Textarea, CoachThemeSwitcher } from '../ds.js';

function Field({ label, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>{label}</span>
      {children}
    </label>
  );
}

export function Settings({ state, refresh, onTheme }) {
  const u = state.user || {};
  const p = state.project || {};
  const [form, setForm] = useState({
    objectif: p.objectif ?? '',
    duree_semaines: p.duree_semaines ?? 12,
    poids_cible: u.poids_cible ?? '',
    taille: u.taille ?? '',
    niveau: u.niveau ?? '',
    dispo_par_semaine: u.dispo_par_semaine ?? '',
    contraintes: u.contraintes ?? '',
  });
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const set = (key) => (e) => { setForm({ ...form, [key]: e.target.value }); setSaved(false); };

  async function save() {
    setBusy(true);
    try {
      await api.saveProfile(form);
      await refresh();
      setSaved(true);
    } finally {
      setBusy(false);
    }
  }

  async function switchCoach(id) {
    setBusy(true);
    onTheme(id);
    try {
      await api.switchCoach(id);
    } catch {
      onTheme(p.coach_id);
    } finally {
      await refresh().catch(() => {});
      setBusy(false);
    }
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h2 style={{ fontFamily: 'var(--font-display)', margin: '0 0 8px', fontSize: 'var(--text-lg)' }}>Coach</h2>
        <div style={{ overflowX: 'auto' }}>
          <CoachThemeSwitcher active={p.coach_id} onChange={switchCoach} />
        </div>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)', margin: '8px 0 0' }}>
          Le ton et le thème changent ; ton plan et l’historique restent.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', margin: 0, fontSize: 'var(--text-lg)' }}>Projet</h2>
        <Field label="Objectif"><Input value={String(form.objectif)} onChange={set('objectif')} /></Field>
        <Field label="Durée (semaines)"><Input type="number" value={String(form.duree_semaines)} onChange={set('duree_semaines')} /></Field>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', margin: 0, fontSize: 'var(--text-lg)' }}>Profil</h2>
        <Field label="Poids cible (kg)"><Input type="number" value={String(form.poids_cible)} onChange={set('poids_cible')} /></Field>
        <Field label="Taille (cm)"><Input type="number" value={String(form.taille)} onChange={set('taille')} /></Field>
        <Field label="Niveau"><Input value={String(form.niveau)} onChange={set('niveau')} /></Field>
        <Field label="Séances / semaine"><Input type="number" value={String(form.dispo_par_semaine)} onChange={set('dispo_par_semaine')} /></Field>
        <Field label="Contraintes"><Textarea rows={3} value={String(form.contraintes)} onChange={set('contraintes')} /></Field>
      </div>

      <Button onClick={save} disabled={busy}>{busy ? 'Enregistrement…' : saved ? 'Enregistré ✓' : 'Enregistrer'}</Button>

      <Card padding="12px">
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
          Poids de départ : {u.poids_depart != null ? `${u.poids_depart} kg` : '—'} · Mode LLM :{' '}
          {state.hasKey ? 'Gemini' : 'mock (pas de clé API)'}
        </div>
      </Card>
    </div>
  );
}
