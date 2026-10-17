import React, { useMemo, useReducer, useState } from 'react';
import { api } from '../api.js';
import { Button, Card } from '../ds.js';
import { CategoryTag, TierBadge } from '../components/Badges.jsx';
import { PixelLabel } from '../components/Stats.jsx';
import {
  fromAnalysis, planReducer, toRequest, draftErrors, preview,
  MAX_STEPS, MAX_TASKS, MAX_TITLE, MAX_LABEL, DIFFICULTY_MIN, DIFFICULTY_MAX,
  MAX_HABITS, MAX_MILESTONES, PER_WEEK_MIN, PER_WEEK_MAX, BOSS_WEEKS_MIN, BOSS_WEEKS_MAX,
} from '../lib/plan.js';

const KINDS = [
  ['project', 'Projet', 'Des étapes dans l’ordre, jusqu’au boss.'],
  ['routine', 'Routine', 'Tenir un rythme chaque semaine, avec des jalons.'],
];

const MAX_PROMPT = 500;
const EXAMPLES = [
  'Devenir pentester (eJPT), 1 à 2 h par jour',
  'Parler italien couramment',
  'Courir un semi-marathon en moins de 2 h',
];

// Create a goal: type it → the coach rates and plans it → edit → confirm.
// Nothing is saved before "Créer l'objectif".
export function NewGoal({ categories, onCancel, onCreated }) {
  const [prompt, setPrompt] = useState('');
  const [phase, setPhase] = useState('input');   // input | analyzing | preview | saving
  const [error, setError] = useState(null);
  const [draft, dispatch] = useReducer(
    (d, a) => (a.type === 'load' ? a.draft : planReducer(d, a)),
    null,
  );

  async function analyze() {
    const text = prompt.trim();
    if (!text || phase === 'analyzing') return;
    setPhase('analyzing');
    setError(null);
    try {
      const r = await api.analyzeGoal(text);
      dispatch({ type: 'load', draft: fromAnalysis(r) });
      setPhase('preview');
    } catch (err) {
      setError(err.status === 502
        ? 'Le coach est indisponible pour le moment. Réessaie dans un instant.'
        : 'Impossible d’analyser cet objectif. Vérifie que le serveur tourne.');
      setPhase('input');
    }
  }

  async function create() {
    if (draftErrors(draft).length || phase === 'saving') return;
    setPhase('saving');
    setError(null);
    try {
      const { goal } = await api.createGoal(toRequest(draft));
      onCreated(goal);
    } catch {
      setError('L’objectif n’a pas pu être créé. Tes modifications sont gardées, réessaie.');
      setPhase('preview');
    }
  }

  const header = (
    <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <h1 style={{ margin: 0, fontSize: 'var(--text-xl)', fontWeight: 800 }}>Nouvel objectif</h1>
      <Button variant="ghost" size="sm" onClick={onCancel}>Annuler</Button>
    </header>
  );

  if (phase === 'input' || phase === 'analyzing') {
    const busy = phase === 'analyzing';
    return (
      <div className="screen">
        {header}
        <label htmlFor="goal-prompt" style={{ fontWeight: 600 }}>Qu’est-ce que tu veux atteindre ?</label>
        <textarea
          id="goal-prompt" className="field" rows={4} maxLength={MAX_PROMPT} disabled={busy}
          placeholder="Ex. Devenir pentester, 1 à 2 h par jour"
          value={prompt} onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) analyze(); }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)' }}>
          <span>Précise ton rythme si tu le connais.</span>
          <span>{prompt.length}/{MAX_PROMPT}</span>
        </div>
        {!prompt && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {EXAMPLES.map((ex) => (
              <button key={ex} className="chip" onClick={() => setPrompt(ex)}>{ex}</button>
            ))}
          </div>
        )}
        {error && <p role="alert" className="error">{error}</p>}
        <div>
          <Button onClick={analyze} disabled={busy || !prompt.trim()}>
            {busy ? 'Le coach analyse…' : 'Analyser avec le coach'}
          </Button>
        </div>
        {busy && (
          <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
            Catégorie, difficulté, étapes et tâches : ça prend une dizaine de secondes.
          </p>
        )}
      </div>
    );
  }

  return <Preview draft={draft} dispatch={dispatch} categories={categories} header={header}
    saving={phase === 'saving'} error={error} onCreate={create}
    onRestart={() => { setPhase('input'); setError(null); }} />;
}

function Preview({ draft, dispatch, categories, header, saving, error, onCreate, onRestart }) {
  const p = useMemo(() => preview(draft, categories), [draft, categories]);
  const errors = draftErrors(draft);

  return (
    <div className="screen">
      {header}

      {draft.intro && (
        <Card padding="12px 14px">
          <PixelLabel>Le coach</PixelLabel>
          <p style={{ margin: '4px 0 0', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>{draft.intro}</p>
        </Card>
      )}

      <div className="form-row">
        <label htmlFor="goal-title">Titre</label>
        <input id="goal-title" className="field" maxLength={MAX_TITLE} value={draft.title}
          onChange={(e) => dispatch({ type: 'title', value: e.target.value })} />
      </div>

      <fieldset className="form-row" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend>Type</legend>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {KINDS.map(([id, label, hint]) => (
            <button key={id} className="chip" aria-pressed={draft.kind === id} style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}
              onClick={() => dispatch({ type: 'kind', value: id })}>
              <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>{label}</span>
              <span style={{ fontSize: 'var(--text-xs)' }}>{hint}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="form-row" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend>Catégorie</legend>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {categories.map((c) => (
            <button key={c.id} className="chip" aria-pressed={draft.category === c.id}
              onClick={() => dispatch({ type: 'category', value: c.id })}>
              <CategoryTag id={c.id} name={c.name} />
            </button>
          ))}
        </div>
      </fieldset>

      <div className="form-row">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label htmlFor="goal-difficulty">Difficulté</label>
          <TierBadge tier={p.tier} difficulty={draft.difficulty} />
        </div>
        <input id="goal-difficulty" type="range" className="range" min={DIFFICULTY_MIN} max={DIFFICULTY_MAX} step={50}
          value={draft.difficulty} onChange={(e) => dispatch({ type: 'difficulty', value: e.target.value })} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)' }}>
          <span>{DIFFICULTY_MIN}</span>
          <span>
            Estimation du coach : {draft.coachDifficulty}
            {draft.difficulty !== draft.coachDifficulty && (
              <button className="link" onClick={() => dispatch({ type: 'difficulty', value: draft.coachDifficulty })}> · rétablir</button>
            )}
          </span>
          <span>{DIFFICULTY_MAX}</span>
        </div>
      </div>

      {draft.kind === 'routine'
        ? <RoutineEditor draft={draft} dispatch={dispatch} p={p} />
        : <ProjectEditor draft={draft} dispatch={dispatch} p={p} />}

      {errors.length > 0 && (
        <ul role="status" className="error" style={{ margin: 0, paddingLeft: 18 }}>
          {errors.map((e) => <li key={e}>{e}</li>)}
        </ul>
      )}
      {error && <p role="alert" className="error">{error}</p>}

      <div className="actions">
        <Button onClick={onCreate} disabled={saving || errors.length > 0}>{saving ? 'Création…' : 'Créer l’objectif'}</Button>
        <Button variant="ghost" onClick={onRestart} disabled={saving}>Reformuler</Button>
      </div>
    </div>
  );
}

function ProjectEditor({ draft, dispatch, p }) {
  const taskCount = draft.steps.reduce((n, s) => n + s.tasks.filter((t) => t.label.trim()).length, 0);
  return (
    <>
        <Card padding="12px 14px">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, textAlign: 'center' }}>
            <Gain label="par étape" value={`+${p.stepGain}`} />
            <Gain label="boss final" value={`+${p.bossGain}`} />
            <Gain label="par tâche" value={`${p.xpPerTask} XP`} />
          </div>
          <p style={{ margin: '8px 0 0', fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)', textAlign: 'center' }}>
            Elo à ton niveau actuel ({Math.round(p.categoryElo)}). Chaque tâche cochée rapporte sa part de l’étape.
          </p>
        </Card>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h2 style={{ margin: 0, fontSize: 'var(--text-md)' }}>Plan</h2>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
            {draft.steps.length} étape{draft.steps.length > 1 ? 's' : ''} · {taskCount} tâche{taskCount > 1 ? 's' : ''}
          </span>
        </div>

        {draft.steps.map((s, i) => (
          <Card key={s.key} padding="12px">
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <PixelLabel style={{ flex: 'none' }}>{i + 1}</PixelLabel>
              <textarea className="field field-strong field-auto" rows={1} aria-label={`Titre de l’étape ${i + 1}`} maxLength={MAX_TITLE}
                value={s.title} placeholder="Titre de l’étape"
                onChange={(e) => dispatch({ type: 'stepTitle', step: s.key, value: e.target.value.replace(/\n/g, ' ') })} />
              <button className="icon-btn" aria-label={`Supprimer l’étape ${i + 1}`} disabled={draft.steps.length <= 1}
                onClick={() => dispatch({ type: 'removeStep', step: s.key })}>×</button>
            </div>
            <ul style={{ listStyle: 'none', margin: '8px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {s.tasks.map((t, j) => (
                <li key={t.key} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span aria-hidden className="task-box" />
                  <textarea className="field field-auto" rows={1} aria-label={`Tâche ${j + 1} de l’étape ${i + 1}`} maxLength={MAX_LABEL}
                    value={t.label} placeholder="Action concrète"
                    onChange={(e) => dispatch({ type: 'taskLabel', step: s.key, task: t.key, value: e.target.value.replace(/\n/g, ' ') })} />
                  <button className="icon-btn" aria-label={`Supprimer la tâche ${j + 1}`} disabled={s.tasks.length <= 1}
                    onClick={() => dispatch({ type: 'removeTask', step: s.key, task: t.key })}>×</button>
                </li>
              ))}
            </ul>
            {s.tasks.length < MAX_TASKS && (
              <button className="link" style={{ marginTop: 8 }} onClick={() => dispatch({ type: 'addTask', step: s.key })}>+ Ajouter une tâche</button>
            )}
          </Card>
        ))}
        {draft.steps.length < MAX_STEPS && (
          <div><Button variant="secondary" size="sm" onClick={() => dispatch({ type: 'addStep' })}>+ Ajouter une étape</Button></div>
        )}
    </>
  );
}

function RoutineEditor({ draft, dispatch, p }) {
  return (
    <>
      <Card padding="12px 14px">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, textAlign: 'center' }}>
          <Gain label="par séance" value={`+${fmtGain1(p.sessionGain)}`} />
          <Gain label="semaine tenue" value={`+${p.stepGain}`} />
          <Gain label="par séance" value={`${p.xpPerTask} XP`} />
        </div>
        <p style={{ margin: '8px 0 0', fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)', textAlign: 'center' }}>
          Elo à ton niveau actuel ({Math.round(p.categoryElo)}). Chaque jalon : +{p.stepGain} et {p.xpPerMilestone} XP.
          Boss : +{p.bossGain} après {draft.bossWeeks} semaines tenues d’affilée.
        </p>
      </Card>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h2 style={{ margin: 0, fontSize: 'var(--text-md)' }}>Habitudes</h2>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
          {p.sessionsPerWeek} séance{p.sessionsPerWeek > 1 ? 's' : ''} par semaine
        </span>
      </div>
      {draft.habits.map((h, i) => (
        <Card key={h.key} padding="12px">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <textarea className="field field-strong field-auto" rows={1} aria-label={`Habitude ${i + 1}`} maxLength={MAX_LABEL}
              value={h.label} placeholder="Ex. Lire 20 min"
              onChange={(e) => dispatch({ type: 'habitLabel', habit: h.key, value: e.target.value.replace(/\n/g, ' ') })} />
            <button className="icon-btn" aria-label={`Supprimer l’habitude ${i + 1}`} disabled={draft.habits.length <= 1}
              onClick={() => dispatch({ type: 'removeHabit', habit: h.key })}>×</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
            <button className="icon-btn stepper" aria-label="Une séance de moins" disabled={h.per_week <= PER_WEEK_MIN}
              onClick={() => dispatch({ type: 'habitPerWeek', habit: h.key, value: h.per_week - 1 })}>−</button>
            <span style={{ fontWeight: 700, minWidth: 18, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{h.per_week}</span>
            <button className="icon-btn stepper" aria-label="Une séance de plus" disabled={h.per_week >= PER_WEEK_MAX}
              onClick={() => dispatch({ type: 'habitPerWeek', habit: h.key, value: h.per_week + 1 })}>+</button>
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
              {h.per_week === 7 ? 'fois par semaine (chaque jour)' : 'fois par semaine'}
            </span>
          </div>
        </Card>
      ))}
      {draft.habits.length < MAX_HABITS && (
        <div><Button variant="secondary" size="sm" onClick={() => dispatch({ type: 'addHabit' })}>+ Ajouter une habitude</Button></div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h2 style={{ margin: 0, fontSize: 'var(--text-md)' }}>Jalons</h2>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>sans ordre, cochés quand tu les atteins</span>
      </div>
      {draft.milestones.length > 0 && (
        <Card padding="12px">
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {draft.milestones.map((m, i) => (
              <li key={m.key} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span aria-hidden className="task-box" style={{ borderRadius: '50%' }} />
                <textarea className="field field-auto" rows={1} aria-label={`Jalon ${i + 1}`} maxLength={MAX_TITLE}
                  value={m.label} placeholder="Ex. Premier muscle-up"
                  onChange={(e) => dispatch({ type: 'milestoneLabel', milestone: m.key, value: e.target.value.replace(/\n/g, ' ') })} />
                <button className="icon-btn" aria-label={`Supprimer le jalon ${i + 1}`}
                  onClick={() => dispatch({ type: 'removeMilestone', milestone: m.key })}>×</button>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {draft.milestones.length < MAX_MILESTONES && (
        <div><Button variant="secondary" size="sm" onClick={() => dispatch({ type: 'addMilestone' })}>+ Ajouter un jalon</Button></div>
      )}

      <div className="form-row">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label htmlFor="boss-weeks">Boss final</label>
          <span style={{ fontWeight: 700 }}>{draft.bossWeeks} semaines d’affilée</span>
        </div>
        <input id="boss-weeks" type="range" className="range" min={BOSS_WEEKS_MIN} max={BOSS_WEEKS_MAX} step={1}
          value={draft.bossWeeks} onChange={(e) => dispatch({ type: 'bossWeeks', value: e.target.value })} />
      </div>
    </>
  );
}

// +0,4 style for small per-session gains.
const fmtGain1 = (v) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(v);

function Gain({ label, value }) {
  return (
    <div>
      <div style={{ fontWeight: 700, fontSize: 'var(--text-lg)' }}>{value}</div>
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{label}</div>
    </div>
  );
}
