import React from 'react';
import { LineChart } from '../components/LineChart.jsx';
import { Meter, PixelLabel } from '../components/Stats.jsx';
import { Card } from '../ds.js';
import { Screen } from './Screen.jsx';

// Every Elo starts at 1000: anchor the curve the day before the first point,
// so even a first day of play draws a line rather than a lone dot.
export function withStart(points, start = 1000) {
  if (points.length === 0) return points;
  const d = new Date(`${points[0].date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return [{ date: d.toISOString().slice(0, 10), value: start }, ...points];
}

// É5 shell: proves the wiring (state, theme, chart). Full home screen in É7.
export function Home({ state }) {
  const { user, life_elo: life } = state;
  return (
    <Screen title="Accueil">
      <Card padding="16px">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <PixelLabel color="var(--color-accent)">Niv. {user.level}</PixelLabel>
          <PixelLabel>{user.xpInLevel} / {user.xpForNext} XP</PixelLabel>
        </div>
        <div style={{ marginTop: 8 }}>
          <Meter pct={(user.xpInLevel / user.xpForNext) * 100} color="var(--color-accent)" label="XP du niveau" />
        </div>
      </Card>

      <div>
        <PixelLabel>Elo de vie</PixelLabel>
        <div style={{ fontWeight: 700, fontSize: 48, lineHeight: 1.1 }}>{Math.round(life.value)}</div>
      </div>
      <Card padding="12px">
        <LineChart
          points={withStart(life.series.map((p) => ({ date: p.date, value: p.elo })))}
          label="Elo de vie"
          reference={{ value: 1000, label: 'départ' }}
          emptyText="Coche ta première tâche pour lancer la courbe."
        />
      </Card>
    </Screen>
  );
}
