import React, { useMemo, useRef, useState } from 'react';

// Single-series weight-over-time line chart, inline SVG (no chart lib).
// One series => no legend box: the title above the chart names what is plotted.
// The series colour is the active coach's --color-primary, so the chart rethemes
// with the rest of the app (including the dark data-nerd theme).

const W = 320;
const H = 168;
const PAD = { top: 12, right: 40, bottom: 22, left: 34 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

const fmtDay = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

// Axis ticks on clean numbers rather than raw data bounds.
function niceTicks(min, max, count = 4) {
  const span = max - min || 1;
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const start = Math.floor(min / step) * step;
  const ticks = [];
  for (let v = start; v <= max + step / 2; v += step) ticks.push(+v.toFixed(4));
  return ticks;
}

export function WeightChart({ measurements = [], cible = null }) {
  const [hover, setHover] = useState(null);
  const [table, setTable] = useState(false);
  const svgRef = useRef(null);

  const geo = useMemo(() => {
    if (measurements.length === 0) return null;
    const xs = measurements.map((m) => Date.parse(m.date));
    const ys = measurements.map((m) => m.poids);
    const values = cible != null ? [...ys, cible] : ys;
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    const ticks = niceTicks(lo - 0.5, hi + 0.5);
    const yMin = Math.min(ticks[0], lo);
    const yMax = Math.max(ticks.at(-1), hi);
    const xMin = Math.min(...xs);
    const xMax = Math.max(...xs);

    const x = (t) => (xMax === xMin ? PAD.left + PLOT_W : PAD.left + ((t - xMin) / (xMax - xMin)) * PLOT_W);
    const y = (v) => PAD.top + PLOT_H - ((v - yMin) / (yMax - yMin || 1)) * PLOT_H;
    const pts = measurements.map((m, i) => ({ ...m, cx: x(xs[i]), cy: y(m.poids) }));
    return { pts, ticks, x, y, yMin, yMax };
  }, [measurements, cible]);

  if (!geo) {
    return (
      <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', margin: 0 }}>
        Pas encore de pesée — logge ton poids pour voir la courbe.
      </p>
    );
  }

  const { pts, ticks, y } = geo;
  const last = pts.at(-1);
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.cx.toFixed(1)} ${p.cy.toFixed(1)}`).join(' ');
  const area = `${path} L${last.cx.toFixed(1)} ${PAD.top + PLOT_H} L${pts[0].cx.toFixed(1)} ${PAD.top + PLOT_H} Z`;
  const active = hover != null ? pts[hover] : null;

  // Map a pointer position to the nearest data point (hit target = whole plot).
  function onMove(e) {
    const rect = svgRef.current.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0;
    for (let i = 1; i < pts.length; i++) {
      if (Math.abs(pts[i].cx - px) < Math.abs(pts[best].cx - px)) best = i;
    }
    setHover(best);
  }

  return (
    <div>
      <div style={{ position: 'relative' }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          role="img"
          aria-label="Évolution du poids dans le temps"
          style={{ display: 'block', touchAction: 'pan-y' }}
          onPointerMove={onMove}
          onPointerDown={onMove}
          onPointerLeave={() => setHover(null)}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)}
                stroke="var(--color-border)" strokeWidth="1"
              />
              <text
                x={PAD.left - 6} y={y(t) + 3} textAnchor="end"
                fontSize="9" fill="var(--color-text-muted)"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {t}
              </text>
            </g>
          ))}

          {/* Target weight: a reference line, not a series — muted ink, labelled. */}
          {cible != null && cible >= geo.yMin && cible <= geo.yMax && (
            <g>
              <line
                x1={PAD.left} x2={W - PAD.right} y1={y(cible)} y2={y(cible)}
                stroke="var(--color-text-muted)" strokeWidth="1"
              />
              <text x={W - PAD.right + 4} y={y(cible) + 3} fontSize="9" fill="var(--color-text-muted)">
                cible
              </text>
            </g>
          )}

          <path d={area} fill="var(--color-primary)" opacity="0.1" />
          <path
            d={path} fill="none" stroke="var(--color-primary)"
            strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"
          />

          {active && (
            <line
              x1={active.cx} x2={active.cx} y1={PAD.top} y2={PAD.top + PLOT_H}
              stroke="var(--color-text-muted)" strokeWidth="1"
            />
          )}

          {/* End marker + the one direct label; the axis carries the rest. */}
          <circle cx={last.cx} cy={last.cy} r="4.5" fill="var(--color-primary)"
            stroke="var(--color-surface)" strokeWidth="2" />
          <text
            x={Math.min(last.cx + 8, W - PAD.right + 2)} y={last.cy - 8}
            fontSize="10" fontWeight="700" fill="var(--color-text)"
          >
            {last.poids} kg
          </text>

          {active && active !== last && (
            <circle cx={active.cx} cy={active.cy} r="4.5" fill="var(--color-primary)"
              stroke="var(--color-surface)" strokeWidth="2" />
          )}

          <text x={PAD.left} y={H - 6} fontSize="9" fill="var(--color-text-muted)">{fmtDay(pts[0].date)}</text>
          {pts.length > 1 && (
            <text x={W - PAD.right} y={H - 6} textAnchor="end" fontSize="9" fill="var(--color-text-muted)">
              {fmtDay(last.date)}
            </text>
          )}
        </svg>

        {active && (
          <div
            style={{
              position: 'absolute', top: 0, pointerEvents: 'none',
              left: `${(active.cx / W) * 100}%`,
              transform: `translateX(${active.cx > W / 2 ? '-105%' : '5%'})`,
              background: 'var(--color-surface)', border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm, 6px)', padding: '4px 8px',
              fontSize: 'var(--text-xs)', whiteSpace: 'nowrap',
            }}
          >
            <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{active.poids} kg</strong>
            <span style={{ color: 'var(--color-text-muted)' }}> · {fmtDay(active.date)}</span>
          </div>
        )}
      </div>

      <button
        onClick={() => setTable((v) => !v)}
        style={{
          background: 'none', border: 'none', padding: '4px 0', cursor: 'pointer',
          color: 'var(--color-text-muted)', font: 'inherit', fontSize: 'var(--text-xs)',
          textDecoration: 'underline',
        }}
      >
        {table ? 'Masquer' : 'Voir'} les valeurs
      </button>

      {table && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-xs)' }}>
          <thead>
            <tr style={{ color: 'var(--color-text-muted)', textAlign: 'left' }}>
              <th style={{ fontWeight: 600, padding: '4px 0' }}>Date</th>
              <th style={{ fontWeight: 600, padding: '4px 0', textAlign: 'right' }}>Poids</th>
            </tr>
          </thead>
          <tbody>
            {[...pts].reverse().map((p, i) => (
              <tr key={`${p.date}-${i}`} style={{ borderTop: '1px solid var(--color-border)' }}>
                <td style={{ padding: '4px 0' }}>{p.date}</td>
                <td style={{ padding: '4px 0', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{p.poids} kg</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
