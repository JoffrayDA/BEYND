import React from 'react';
import { Card } from '../ds.js';
import { WeightChart } from '../components/WeightChart.jsx';

function StatTile({ label, value, sub }) {
  return (
    <Card padding="12px" style={{ flex: 1 }}>
      <div style={{
        fontSize: 10, letterSpacing: 'var(--tracking-wide)', textTransform: 'uppercase',
        color: 'var(--color-text-muted)', fontWeight: 700,
      }}>{label}</div>
      <div style={{ fontWeight: 700, fontSize: 'var(--text-lg)' }}>{value}</div>
      {sub && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{sub}</div>}
    </Card>
  );
}

// Meter: fill = accent ramp, unfilled track = a lighter step of the same hue,
// so the state reads across the whole bar.
function Meter({ pct }) {
  return (
    <div style={{
      height: 10, borderRadius: 999, overflow: 'hidden',
      background: 'color-mix(in srgb, var(--color-primary) 16%, var(--color-surface))',
    }}>
      <div style={{ width: `${pct}%`, height: '100%', background: 'var(--color-primary)' }} />
    </div>
  );
}

export function Dashboard({ state }) {
  const m = state.metrics || {};
  const p = state.progress || {};
  const depuisDepart = m.actuel != null && p.poids_depart != null
    ? +(m.actuel - p.poids_depart).toFixed(1)
    : null;
  const signe = (v) => `${v > 0 ? '+' : ''}${v}`;

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div style={{
          fontSize: 10, letterSpacing: 'var(--tracking-wide)', textTransform: 'uppercase',
          color: 'var(--color-text-muted)', fontWeight: 700,
        }}>
          Semaine {p.semaine_courante ?? 1} / {p.duree_semaines ?? 12}
        </div>
        <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 48, lineHeight: 1.1 }}>
          {m.actuel != null ? `${m.actuel} kg` : '—'}
        </div>
        {depuisDepart != null && (
          <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
            {signe(depuisDepart)} kg depuis le départ ({p.poids_depart} kg)
          </div>
        )}
      </div>

      {p.pct_objectif != null && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)' }}>
            <span style={{ fontWeight: 600 }}>Progression vers {p.poids_cible} kg</span>
            <span style={{ color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>{p.pct_objectif}%</span>
          </div>
          <Meter pct={p.pct_objectif} />
          {p.reste_kg != null && (
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
              Reste {Math.abs(p.reste_kg)} kg
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <StatTile label="Tendance 7j" value={`${signe(m.tendance7 ?? 0)} kg`} />
        <StatTile label="Adhérence" value={`${m.adherence ?? 0}%`} sub={`${m.faits ?? 0}/${m.total ?? 0} engagements`} />
      </div>

      <div>
        <h2 style={{ fontFamily: 'var(--font-display)', margin: '0 0 2px', fontSize: 'var(--text-lg)' }}>Poids</h2>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)', margin: '0 0 8px' }}>
          Toutes tes pesées depuis le début du projet.
        </p>
        <Card padding="12px">
          <WeightChart measurements={m.measurements || []} cible={p.poids_cible ?? null} />
        </Card>
      </div>
    </div>
  );
}
