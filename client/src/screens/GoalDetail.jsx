import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { Button, Card } from '../ds.js';
import { CategoryTag, TierBadge } from '../components/Badges.jsx';
import { Meter, PixelLabel, StatTile } from '../components/Stats.jsx';
import { useTaskToggle } from '../components/useTaskToggle.jsx';
import { fmtElo, fmtGain } from '../lib/home.js';
import { currentStepIndex, taskGain } from '../lib/goals.js';

const MAX_TITLE = 80;

// One goal: its rating and what it is worth, then every step and task —
// tickable here too, with the same feedback as the daily quest.
export function GoalDetail({ id, state, setState, refresh, onBack }) {
  const [goal, setGoal] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [renaming, setRenaming] = useState(null);      // draft title | null
  const [openDone, setOpenDone] = useState(() => new Set());

  const load = useCallback(async () => {
    try {
      setGoal((await api.goal(id)).goal);
      setError(null);
    } catch (err) {
      setError(err.status === 404 ? 'Cet objectif n’existe plus.' : 'Impossible de charger cet objectif.');
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const { toggle, busy, error: toggleError, overlay } = useTaskToggle({ user: state.user, setState, onDone: load });

  async function patch(body) {
    if (saving) return;
    setSaving(true);
    try {
      setGoal((await api.updateGoal(id, body)).goal);
      setError(null);
      await refresh();
    } catch {
      setError('La modification n’a pas pu être enregistrée. Réessaie.');
    } finally {
      setSaving(false);
    }
  }

  async function rename() {
    const title = renaming.replace(/\s+/g, ' ').trim();
    if (!title) return;
    await patch({ title });
    setRenaming(null);
  }

  const back = <button className="link" onClick={onBack} style={{ alignSelf: 'flex-start' }}>‹ Objectifs</button>;

  if (!goal) {
    return (
      <div className="screen">
        {back}
        {error
          ? <p role="alert" className="error">{error} <button className="link" onClick={load}>Réessayer</button></p>
          : <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>Chargement…</p>}
      </div>
    );
  }

  const archived = goal.status === 'archived';
  const done = goal.status === 'done';
  const current = currentStepIndex(goal.steps);
  const p = goal.progress;

  return (
    <div className="screen">
      {back}

      <section style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <CategoryTag id={goal.category_id} name={goal.category_name} muted />
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {goal.is_main && <PixelLabel color="var(--color-accent)">Principal</PixelLabel>}
            <TierBadge tier={goal.tier} difficulty={goal.difficulty} />
          </div>
        </div>
        {renaming == null ? (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <h1 style={{ margin: 0, fontSize: 'var(--text-xl)', fontWeight: 800, flex: 1 }}>{goal.title}</h1>
            <button className="link" onClick={() => setRenaming(goal.title)}>Renommer</button>
          </div>
        ) : (
          <form className="form-row" onSubmit={(e) => { e.preventDefault(); rename(); }}>
            <label htmlFor="rename">Titre</label>
            <input id="rename" className="field field-strong" autoFocus maxLength={MAX_TITLE} value={renaming}
              onChange={(e) => setRenaming(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') setRenaming(null); }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <Button size="sm" type="submit" disabled={saving || !renaming.trim()}>Enregistrer</Button>
              <Button size="sm" variant="ghost" onClick={() => setRenaming(null)}>Annuler</Button>
            </div>
          </form>
        )}
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
          {done ? 'Boss vaincu' : archived ? 'Archivé : ses tâches ne sont plus dans ta Quête du jour.' : `Étape ${p.steps_done + 1}/${p.steps_total} · ${goal.current_step}`}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
          <div style={{ flex: 1 }}><Meter pct={p.pct} color={`var(--cat-${goal.category_id})`} label={`Avancement de ${goal.title}`} /></div>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
            {p.tasks_done}/{p.tasks_total} tâches
          </span>
        </div>
      </section>

      {/* What it is worth at the current category Elo */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <StatTile label={`Elo ${goal.category_name}`} value={fmtElo(goal.category_elo)} mark={`var(--cat-${goal.category_id})`} />
        <StatTile label="Difficulté" value={goal.difficulty} sub={goal.tier.label} />
        <StatTile label="Par étape franchie" value={`+${goal.potential_gain}`} sub="Elo, à ton niveau actuel" />
        <StatTile label="Boss final" value={`+${goal.potential_gain * 2}`} sub={done ? 'déjà vaincu' : 'Elo, à la dernière tâche'} />
      </div>

      {goal.coach_intro && (
        <Card padding="12px 14px">
          <PixelLabel>Le coach</PixelLabel>
          <p style={{ margin: '4px 0 0', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>{goal.coach_intro}</p>
        </Card>
      )}

      <section aria-labelledby="steps-title" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h2 id="steps-title" style={{ margin: 0, fontSize: 'var(--text-lg)' }}>Étapes</h2>
        {goal.steps.map((s, i) => {
          const stepDone = s.status === 'done';
          const expanded = !stepDone || openDone.has(s.id);
          const doneCount = s.tasks.filter((t) => t.done_on).length;
          const each = taskGain(goal.difficulty, goal.category_elo, s.tasks.length);
          return (
            <Card key={s.id} padding="12px" style={i === current && !archived ? { borderColor: 'var(--color-border-strong)' } : undefined}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span aria-hidden className={`check${stepDone ? ' on' : ''}`} style={{ borderRadius: 4 }}>{stepDone ? '✓' : i + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700 }}>{s.title}</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                    {stepDone ? 'Franchie' : i === current ? 'En cours' : 'À venir'} · {doneCount}/{s.tasks.length}
                  </div>
                </div>
                {stepDone && (
                  <button className="link" aria-expanded={expanded}
                    onClick={() => setOpenDone((o) => { const n = new Set(o); n.has(s.id) ? n.delete(s.id) : n.add(s.id); return n; })}>
                    {expanded ? 'Masquer' : 'Voir'}
                  </button>
                )}
              </div>
              {expanded && (
                <ul className="quest" style={{ marginTop: 10 }}>
                  {s.tasks.map((t) => {
                    const on = t.done_on != null;
                    return (
                      <li key={t.id}>
                        <button className="quest-item" aria-pressed={on} disabled={archived || busy != null}
                          onClick={() => toggle(t.id, { goalTitle: goal.title, stepTitle: s.title })}>
                          <span aria-hidden className={`check${on ? ' on' : ''}`}>{busy === t.id ? '…' : on ? '✓' : ''}</span>
                          <span className="quest-label" style={{ flex: 1, minWidth: 0, ...(on ? { textDecoration: 'line-through', color: 'var(--color-text-muted)' } : {}) }}>
                            {t.label}
                          </span>
                          <span style={{ textAlign: 'right', flex: 'none' }}>
                            {!on && <span style={{ display: 'block', fontWeight: 700, fontSize: 'var(--text-sm)' }}>{fmtGain(each)}</span>}
                            <PixelLabel color={on ? 'var(--color-text-subtle)' : 'var(--elo-gold)'}>{t.xp} XP</PixelLabel>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          );
        })}
        {toggleError && <p role="alert" className="error">{toggleError}</p>}
      </section>

      {error && <p role="alert" className="error">{error}</p>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {!goal.is_main && !archived && (
          <Button variant="secondary" size="sm" disabled={saving} onClick={() => patch({ is_main: true })}>Définir comme principal</Button>
        )}
        {archived ? (
          <Button variant="secondary" size="sm" disabled={saving} onClick={() => patch({ status: 'active' })}>Réactiver</Button>
        ) : (
          <Button variant="ghost" size="sm" disabled={saving} onClick={() => patch({ status: 'archived' })}>Archiver</Button>
        )}
      </div>
      {!archived && (
        <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)' }}>
          Archiver retire l’objectif de l’Accueil sans effacer l’Elo gagné. Tu peux le réactiver.
        </p>
      )}

      {overlay}
    </div>
  );
}
