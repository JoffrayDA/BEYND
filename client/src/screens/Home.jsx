import React from 'react';
import { Button, Card } from '../ds.js';
import { LineChart } from '../components/LineChart.jsx';
import { Delta, Meter, PixelLabel } from '../components/Stats.jsx';
import { CategoryTag, TierBadge } from '../components/Badges.jsx';
import { Avatar, Flame } from '../components/Avatar.jsx';
import { fmtElo, fmtGain } from '../lib/home.js';
import { withStart } from '../lib/progress.js';
import { routineLine } from '../lib/goals.js';
import { useTaskToggle } from '../components/useTaskToggle.jsx';
import { LevelUpCard } from '../components/LevelUpCard.jsx';
import { RaidCard } from '../components/RaidCard.jsx';

export function Home({ state, setState, onNewGoal, onOpenGoal }) {
  const { user, life_elo: life, main_goal: main, quest } = state;
  const active = state.categories.filter((c) => c.active);
  const { toggle, busy, isBusy, error, overlay } = useTaskToggle({ user, setState });
  const target = (q) => (q.type === 'habit' ? { type: 'habit', id: q.habit_id } : { type: 'task', id: q.task_id });

  return (
    <div className="screen">
      {/* Character: avatar, level, XP, streak */}
      <section style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        <Avatar level={user.level} gear={user.gear} />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <PixelLabel color="var(--elo-gold)" style={{ fontSize: 12 }}>Niv. {user.level}</PixelLabel>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
              aria-label={`Série de ${user.streak} jour${user.streak > 1 ? 's' : ''}`}>
              <Flame lit={user.streak > 0} />
              <PixelLabel color={user.streak > 0 ? 'var(--color-text)' : 'var(--color-text-subtle)'}>{user.streak} j</PixelLabel>
            </span>
          </div>
          <Meter pct={(user.xpInLevel / user.xpForNext) * 100} color="var(--elo-gold)" label="XP du niveau" />
          <PixelLabel>{user.xpInLevel} / {user.xpForNext} XP</PixelLabel>
        </div>
      </section>

      {state.raid && <RaidCard raid={state.raid} today={state.today} user={user} setState={setState} />}

      {!main ? (
        <Card padding="20px">
          <PixelLabel color="var(--color-primary)">Quête 1</PixelLabel>
          <h2 style={{ margin: '6px 0 4px', fontSize: 'var(--text-lg)' }}>Pose ton premier objectif</h2>
          <p style={{ margin: '0 0 14px', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
            Le coach estime sa difficulté, le découpe en étapes et en tâches. Chaque tâche cochée fait monter ton Elo.
          </p>
          <Button onClick={onNewGoal}>Créer un objectif</Button>
        </Card>
      ) : (
        <>
          {/* Life Elo */}
          <section>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <div>
                <PixelLabel>Elo de vie</PixelLabel>
                <div style={{ fontWeight: 800, fontSize: 48, lineHeight: 1.05 }}>{fmtElo(life.value)}</div>
              </div>
              <Delta value={life.delta_today} suffix="aujourd’hui" />
            </div>
            <Card padding="12px" style={{ marginTop: 8 }}>
              <LineChart
                points={withStart(life.series.map((p) => ({ date: p.date, value: p.elo })))}
                label="Elo de vie" height={140}
                reference={{ value: 1000, label: 'départ' }}
                emptyText="Coche ta première tâche pour lancer la courbe."
              />
            </Card>
          </section>

          {/* Daily quest */}
          <section aria-labelledby="quest-title">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
              <h2 id="quest-title" style={{ margin: 0, fontSize: 'var(--text-lg)' }}>Quête du jour</h2>
              <PixelLabel>{quest.filter((q) => q.done).length}/{quest.length}</PixelLabel>
            </div>
            {state.level_ups?.map((l) => <LevelUpCard key={l.goal_id} offer={l} setState={setState} />)}
            {quest.length === 0 ? (
              <Card padding="16px">
                <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
                  Plus rien à cocher : tous tes objectifs actifs sont terminés. Pose le suivant.
                </p>
              </Card>
            ) : (
              <ul className="quest">
                {quest.map((q) => (
                  <li key={q.key}>
                    <button className="quest-item" aria-pressed={q.done} disabled={busy != null} onClick={() => toggle(target(q), { goalTitle: q.goal_title, stepTitle: q.step_title })}>
                      <span aria-hidden className={`check${q.done ? ' on' : ''}`}>{isBusy(target(q).type, target(q).id) ? '…' : q.done ? '✓' : ''}</span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span className="quest-label" style={q.done ? { textDecoration: 'line-through', color: 'var(--color-text-muted)' } : undefined}>{q.label}</span>
                        <span className="quest-sub">
                          <span aria-hidden style={{ width: 6, height: 6, borderRadius: 1, background: `var(--cat-${q.category_id})`, display: 'inline-block', marginRight: 6 }} />
                          {q.type === 'habit' ? `Cette semaine ${q.week_count}/${q.per_week}` : q.step_title} · {q.goal_title}
                        </span>
                      </span>
                      <span style={{ textAlign: 'right', flex: 'none' }}>
                        <span style={{ display: 'block', fontWeight: 700, fontSize: 'var(--text-sm)', color: q.done ? 'var(--color-text-subtle)' : 'var(--color-text)' }}>{fmtGain(q.elo_gain)}</span>
                        <PixelLabel color={q.done ? 'var(--color-text-subtle)' : 'var(--elo-gold)'}>{q.xp} XP</PixelLabel>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {error && <p role="alert" className="error" style={{ marginTop: 8 }}>{error}</p>}
          </section>

          {/* Category Elo */}
          {active.length > 0 && (
            <section>
              <h2 style={{ margin: '0 0 8px', fontSize: 'var(--text-lg)' }}>Elo par catégorie</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {active.map((c) => (
                  <Card key={c.id} padding="12px">
                    <CategoryTag id={c.id} name={c.name} muted />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 4 }}>
                      <span style={{ fontWeight: 800, fontSize: 'var(--text-xl)' }}>{fmtElo(c.elo)}</span>
                      <Delta value={c.delta_today} small />
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {/* Main goal = the boss */}
          <section>
            <h2 style={{ margin: '0 0 8px', fontSize: 'var(--text-lg)' }}>Objectif principal</h2>
            <button className="card-button" onClick={() => onOpenGoal(main.id)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <CategoryTag id={main.category_id} name={main.category_name} muted />
                <TierBadge tier={main.tier} difficulty={main.difficulty} />
              </div>
              <div style={{ fontWeight: 800, fontSize: 'var(--text-md)', margin: '6px 0 2px' }}>{main.title}</div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                {main.status === 'done' ? 'Boss vaincu' : main.routine ? routineLine(main.routine) : `Étape ${main.progress.steps_done + 1}/${main.progress.steps_total} · ${main.current_step}`}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                <div style={{ flex: 1 }}><Meter pct={main.progress.pct} color={`var(--cat-${main.category_id})`} height={6} label={`Avancement de ${main.title}`} /></div>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>{main.progress.pct} %</span>
              </div>
              {main.status !== 'done' && !main.routine?.boss_done && (
                <div style={{ marginTop: 8, fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                  Boss final : <strong style={{ color: 'var(--color-text)' }}>+{main.potential_gain * 2} Elo</strong> à ton niveau actuel
                  {main.routine && ` · après ${main.routine.boss_weeks} semaines tenues`}
                </div>
              )}
            </button>
          </section>
        </>
      )}

      {overlay}
    </div>
  );
}
