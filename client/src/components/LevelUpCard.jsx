import React, { useState } from 'react';
import { api } from '../api.js';
import { Button, Card } from '../ds.js';
import { PixelLabel } from './Stats.jsx';
import { fmtElo } from '../lib/home.js';

const MAX_LABEL = 160;

// Shown in the daily quest once a routine's category Elo passed its
// difficulty: its sessions now pay almost nothing. One more session a week,
// or a more demanding habit — either way +150 difficulty. Or later (7 days).
export function LevelUpCard({ offer, setState, onDone }) {
  const [mode, setMode] = useState(null);                  // null | 'frequency' | 'harder'
  const [habitId, setHabitId] = useState(offer.habits[0]?.id);
  const [label, setLabel] = useState(offer.habits[0]?.label ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const habit = offer.habits.find((h) => h.id === habitId);
  const canMore = offer.habits.some((h) => h.per_week < 7);

  async function send(body) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api.levelUp(offer.goal_id, body);
      setState((s) => ({ ...s, ...r.state }));
      await onDone?.();
    } catch {
      setError('Le changement n’a pas pu être enregistré. Réessaie.');
      setBusy(false);
    }
  }

  const pickHabit = (h) => { setHabitId(h.id); setLabel(h.label); };

  return (
    <Card padding="14px" style={{ marginBottom: 8, borderColor: 'var(--elo-gold)' }}>
      <PixelLabel color="var(--elo-gold)">Monter d’un cran</PixelLabel>
      <p style={{ margin: '6px 0 2px', fontWeight: 700 }}>{offer.goal_title}</p>
      <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
        Ton Elo ({fmtElo(offer.category_elo)}) a dépassé la difficulté de cette routine ({offer.difficulty}) :
        ses séances ne rapportent presque plus rien. Monte à <strong style={{ color: 'var(--color-text)' }}>{offer.new_difficulty}</strong>.
      </p>

      {mode == null ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
          {canMore && <Button size="sm" onClick={() => { setMode('frequency'); pickHabit(offer.habits.find((h) => h.per_week < 7)); }}>Une séance de plus</Button>}
          <Button size="sm" variant="secondary" onClick={() => setMode('harder')}>Plus exigeant</Button>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => send({ mode: 'snooze' })}>Plus tard</Button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
          {offer.habits.length > 1 && (
            <div className="chip-row" role="group" aria-label="Habitude à changer">
              {offer.habits.map((h) => (
                <button key={h.id} className="chip" aria-pressed={h.id === habitId}
                  disabled={mode === 'frequency' && h.per_week >= 7} onClick={() => pickHabit(h)}>
                  {h.label}
                </button>
              ))}
            </div>
          )}
          {mode === 'frequency' ? (
            <p style={{ margin: 0, fontSize: 'var(--text-sm)' }}>
              {habit?.label} : {habit?.per_week} → <strong>{(habit?.per_week ?? 0) + 1}</strong> fois par semaine.
            </p>
          ) : (
            <div className="form-row">
              <label htmlFor={`harder-${offer.goal_id}`}>Nouvelle version de l’habitude</label>
              <input id={`harder-${offer.goal_id}`} className="field" maxLength={MAX_LABEL} value={label}
                placeholder="Ex. Lire 30 min" onChange={(e) => setLabel(e.target.value)} />
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <Button size="sm" disabled={busy || (mode === 'harder' && (!label.trim() || label.trim() === habit?.label))}
              onClick={() => send(mode === 'frequency' ? { mode, habit_id: habitId } : { mode, habit_id: habitId, label })}>
              {busy ? 'Enregistrement…' : 'Valider'}
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setMode(null)}>Retour</Button>
          </div>
        </div>
      )}
      {error && <p role="alert" className="error" style={{ marginTop: 8 }}>{error}</p>}
    </Card>
  );
}
