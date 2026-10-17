import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { Button, Card } from '../ds.js';
import { CategoryTag, TierBadge } from '../components/Badges.jsx';
import { Meter, PixelLabel } from '../components/Stats.jsx';
import { Screen } from './Screen.jsx';
import { NewGoal } from './NewGoal.jsx';

// Goals tab. É6: list + creation flow. Filters and goal detail come in É8.
export function Goals({ state, refresh, startCreating = false }) {
  const [goals, setGoals] = useState(null);
  const [creating, setCreating] = useState(startCreating);
  const [justCreated, setJustCreated] = useState(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      setGoals((await api.goals()).goals);
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
          setJustCreated(goal.id);
          await Promise.all([load(), refresh()]);
        }}
      />
    );
  }

  return (
    <Screen title="Objectifs" action={<Button size="sm" onClick={() => setCreating(true)}>+ Nouveau</Button>}>
      {error && (
        <p role="alert" className="error">
          Impossible de charger tes objectifs. <button className="link" onClick={load}>Réessayer</button>
        </p>
      )}
      {goals?.length === 0 && (
        <Card padding="20px">
          <p style={{ margin: 0, fontWeight: 600 }}>Aucun objectif pour l’instant.</p>
          <p style={{ margin: '4px 0 12px', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
            Décris ce que tu veux atteindre : le coach estime la difficulté et te propose un plan.
          </p>
          <Button onClick={() => setCreating(true)}>Créer mon premier objectif</Button>
        </Card>
      )}
      {goals?.map((g) => <GoalCard key={g.id} goal={g} highlight={g.id === justCreated} />)}
    </Screen>
  );
}

function GoalCard({ goal, highlight }) {
  const { progress: p } = goal;
  return (
    <Card padding="14px" style={highlight ? { borderColor: 'var(--color-primary)' } : undefined}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
        <CategoryTag id={goal.category_id} name={goal.category_name} muted />
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {goal.is_main && <PixelLabel color="var(--color-accent)">Principal</PixelLabel>}
          <TierBadge tier={goal.tier} difficulty={goal.difficulty} />
        </div>
      </div>
      <div style={{ fontWeight: 700, fontSize: 'var(--text-md)', margin: '6px 0 2px' }}>{goal.title}</div>
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
        {goal.status === 'done' ? 'Terminé' : goal.current_step ?? '—'} · +{goal.potential_gain} Elo par étape
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
        <div style={{ flex: 1 }}><Meter pct={p.pct} color={`var(--cat-${goal.category_id})`} height={6} label={`Avancement de ${goal.title}`} /></div>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
          {p.tasks_done}/{p.tasks_total}
        </span>
      </div>
      {highlight && <p style={{ margin: '8px 0 0', fontSize: 'var(--text-xs)', color: 'var(--color-primary)' }}>Objectif créé. Ses premières tâches sont dans ta Quête du jour.</p>}
    </Card>
  );
}
