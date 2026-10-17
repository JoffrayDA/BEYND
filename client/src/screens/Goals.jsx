import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { Button, Card } from '../ds.js';
import { CategoryTag, TierBadge } from '../components/Badges.jsx';
import { Meter, PixelLabel } from '../components/Stats.jsx';
import { categoryFilters, filterGoals } from '../lib/goals.js';
import { Screen } from './Screen.jsx';
import { NewGoal } from './NewGoal.jsx';
import { GoalDetail } from './GoalDetail.jsx';

// Goals tab: list filtered by category (or the archive), creation flow, and
// one goal's detail. `intent` comes from another tab: { create } or { open: id }.
export function Goals({ state, setState, refresh, intent = {} }) {
  const [lists, setLists] = useState(null);           // { active, archived }
  const [creating, setCreating] = useState(Boolean(intent.create));
  const [openId, setOpenId] = useState(intent.open ?? null);
  const [filter, setFilter] = useState(null);          // category id | null
  const [archive, setArchive] = useState(false);
  const [justCreated, setJustCreated] = useState(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      const [a, b] = await Promise.all([api.goals(), api.goals({ archived: true })]);
      setLists({ active: a.goals, archived: b.goals });
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (creating) {
    return (
      <NewGoal
        categories={state.categories}
        onCancel={() => setCreating(false)}
        onCreated={async (goal) => {
          setCreating(false);
          setArchive(false);
          setFilter(null);
          setJustCreated(goal.id);
          await Promise.all([load(), refresh()]);
        }}
      />
    );
  }

  if (openId != null) {
    return (
      <GoalDetail
        id={openId} state={state} setState={setState} refresh={refresh}
        onBack={() => { setOpenId(null); load(); }}
      />
    );
  }

  const all = lists ? (archive ? lists.archived : lists.active) : null;
  const filters = all ? categoryFilters(all, state.categories) : [];
  // A filter can outlive its last goal (archived meanwhile): fall back to all.
  const current = filters.some((f) => f.id === filter) ? filter : null;
  const goals = all ? filterGoals(all, current) : null;

  return (
    <Screen title="Objectifs" action={<Button size="sm" onClick={() => setCreating(true)}>+ Nouveau</Button>}>
      {error && (
        <p role="alert" className="error">
          Impossible de charger tes objectifs. <button className="link" onClick={load}>Réessayer</button>
        </p>
      )}

      {lists && (lists.active.length > 0 || lists.archived.length > 0) && (
        <div className="chip-row" role="group" aria-label="Filtrer les objectifs">
          {filters.map((f) => (
            <button key={f.id ?? 'all'} className="chip" aria-pressed={current === f.id} onClick={() => setFilter(f.id)}>
              {f.id ? <CategoryTag id={f.id} name={f.name} /> : f.name}
              <span className="chip-count">{f.count}</span>
            </button>
          ))}
          {lists.archived.length > 0 && (
            <button className="chip" aria-pressed={archive} onClick={() => { setArchive(!archive); setFilter(null); }}>
              Archivés<span className="chip-count">{lists.archived.length}</span>
            </button>
          )}
        </div>
      )}

      {lists?.active.length === 0 && !archive && (
        <Card padding="20px">
          <p style={{ margin: 0, fontWeight: 600 }}>Aucun objectif en cours.</p>
          <p style={{ margin: '4px 0 12px', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
            Décris ce que tu veux atteindre : le coach estime la difficulté et te propose un plan.
          </p>
          <Button onClick={() => setCreating(true)}>Créer un objectif</Button>
        </Card>
      )}

      {goals?.map((g) => (
        <GoalCard key={g.id} goal={g} highlight={g.id === justCreated} onOpen={() => setOpenId(g.id)} />
      ))}
    </Screen>
  );
}

function GoalCard({ goal, highlight, onOpen }) {
  const { progress: p } = goal;
  const done = goal.status === 'done';
  const archived = goal.status === 'archived';
  return (
    <button className="card-button" onClick={onOpen} style={highlight ? { borderColor: 'var(--color-primary)' } : undefined}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
        <CategoryTag id={goal.category_id} name={goal.category_name} muted />
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {goal.is_main && <PixelLabel color="var(--color-accent)">Principal</PixelLabel>}
          <TierBadge tier={goal.tier} difficulty={goal.difficulty} />
        </div>
      </div>
      <div style={{ fontWeight: 700, fontSize: 'var(--text-md)', margin: '6px 0 2px' }}>{goal.title}</div>
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
        {done ? 'Boss vaincu' : archived ? 'Archivé' : `Étape ${p.steps_done + 1}/${p.steps_total} · ${goal.current_step ?? '—'}`}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
        <div style={{ flex: 1 }}><Meter pct={p.pct} color={`var(--cat-${goal.category_id})`} height={6} label={`Avancement de ${goal.title}`} /></div>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
          {p.tasks_done}/{p.tasks_total}
        </span>
      </div>
      {!done && !archived && (
        <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
          <span>Étape : <strong style={{ color: 'var(--color-text)' }}>+{goal.potential_gain} Elo</strong></span>
          <span>Boss : <strong style={{ color: 'var(--color-text)' }}>+{goal.potential_gain * 2} Elo</strong></span>
        </div>
      )}
      {highlight && <p style={{ margin: '8px 0 0', fontSize: 'var(--text-xs)', color: 'var(--color-primary)' }}>Objectif créé. Ses premières tâches sont dans ta Quête du jour.</p>}
    </button>
  );
}
