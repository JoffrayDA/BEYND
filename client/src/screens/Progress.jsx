import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { Card } from '../ds.js';
import { LineChart } from '../components/LineChart.jsx';
import { Flame } from '../components/Avatar.jsx';
import { CategoryTag } from '../components/Badges.jsx';
import { Delta, PixelLabel, StatTile } from '../components/Stats.jsx';
import { fmtElo } from '../lib/home.js';
import { activityWeeks, fmtDay, plural, withStart } from '../lib/progress.js';
import { Screen } from './Screen.jsx';

const HISTORY_PAGE = 10;
const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

// Progress tab: streaks, one Elo curve per category (small multiples, never
// overlaid — categories are not compared), and the day-by-day history.
export function Progress() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [shown, setShown] = useState(HISTORY_PAGE);

  const load = useCallback(async () => {
    try {
      setData(await api.progress());
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!data) {
    return (
      <Screen title="Progrès">
        {error
          ? <p role="alert" className="error">Impossible de charger ta progression. <button className="link" onClick={load}>Réessayer</button></p>
          : <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>Chargement…</p>}
      </Screen>
    );
  }

  const { today, streak, categories, history } = data;
  const played = history.filter((d) => d.tasks.length > 0);
  const weeks = activityWeeks(history, today);

  return (
    <Screen title="Progrès">
      {/* Streaks */}
      <section aria-labelledby="streak-title" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h2 id="streak-title" className="sr-only">Séries</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <StatTile label="Série actuelle" value={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Flame lit={streak.current > 0} />{plural(streak.current, 'jour')}</span>} />
          <StatTile label="Meilleure série" value={plural(streak.best, 'jour')} />
          <StatTile label="Jours joués" value={played.length} />
        </div>
        <Card padding="12px">
          <PixelLabel>5 dernières semaines</PixelLabel>
          <div className="activity" role="img"
            aria-label={`${weeks.flat().filter((d) => d.on).length} jours joués sur les 5 dernières semaines`}>
            {WEEKDAYS.map((d, i) => <span key={`h${i}`} className="activity-head" aria-hidden>{d}</span>)}
            {weeks.flat().map((d) => (
              <span key={d.date} title={d.future ? undefined : `${fmtDay(d.date, today)}${d.on ? ' · joué' : ''}`}
                className="activity-day" data-on={d.on} data-today={d.today} data-future={d.future} />
            ))}
          </div>
        </Card>
      </section>

      {/* One curve per category */}
      <section aria-labelledby="curves-title" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h2 id="curves-title" style={{ margin: 0, fontSize: 'var(--text-lg)' }}>Elo par catégorie</h2>
        {categories.length === 0 && (
          <Card padding="16px">
            <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
              Crée un objectif et coche ta première tâche : sa catégorie aura sa courbe ici.
            </p>
          </Card>
        )}
        {categories.map((c) => {
          const delta = c.series.length ? c.elo - 1000 : 0;
          return (
            <Card key={c.id} padding="12px">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <CategoryTag id={c.id} name={c.name} />
                  <span style={{ fontWeight: 800, fontSize: 'var(--text-2xl)', lineHeight: 1.1 }}>{fmtElo(c.elo)}</span>
                </div>
                <Delta value={delta} suffix="depuis le départ" small />
              </div>
              <LineChart
                points={withStart(c.series.map((p) => ({ date: p.date, value: p.elo })))}
                label={`Elo ${c.name}`} color={`var(--cat-${c.id})`} height={120}
                reference={{ value: 1000, label: 'départ' }}
                emptyText={c.active ? 'Pas encore de tâche cochée dans cette catégorie.' : 'Aucune activité.'}
              />
            </Card>
          );
        })}
      </section>

      {/* History */}
      <section aria-labelledby="history-title" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h2 id="history-title" style={{ margin: 0, fontSize: 'var(--text-lg)' }}>Historique</h2>
        {history.length === 0 ? (
          <Card padding="16px">
            <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
              Chaque jour joué apparaîtra ici, avec ses tâches, son Elo et son XP.
            </p>
          </Card>
        ) : (
          <ol className="history">
            {history.slice(0, shown).map((d) => (
              <li key={d.date}>
                <Card padding="12px">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontWeight: 700 }}>{fmtDay(d.date, today)}</span>
                    <span style={{ display: 'inline-flex', gap: 10, alignItems: 'baseline' }}>
                      <Delta value={d.elo_delta} small />
                      <PixelLabel color="var(--elo-gold)">{d.xp >= 0 ? '+' : '−'}{Math.abs(d.xp)} XP</PixelLabel>
                    </span>
                  </div>
                  {d.tasks.length === 0 ? (
                    <p style={{ margin: '4px 0 0', fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)' }}>Coches annulées ce jour-là.</p>
                  ) : (
                    <ul className="history-tasks">
                      {d.tasks.map((t, i) => (
                        <li key={i}>
                          <span aria-hidden style={{ width: 6, height: 6, borderRadius: 1, background: `var(--cat-${t.category_id})`, flex: 'none', marginTop: 7 }} />
                          <span>{t.label} <span style={{ color: 'var(--color-text-subtle)' }}>· {t.goal_title}</span></span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </li>
            ))}
          </ol>
        )}
        {history.length > shown && (
          <button className="link" style={{ alignSelf: 'center' }} onClick={() => setShown(shown + HISTORY_PAGE)}>
            Voir {Math.min(HISTORY_PAGE, history.length - shown)} jours de plus
          </button>
        )}
      </section>
    </Screen>
  );
}
