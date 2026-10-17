import React, { useMemo, useRef, useState } from 'react';

// Single-series line chart over time, inline SVG (no chart lib).
// One series => no legend box: the title above the chart names what is plotted.
// Several categories are shown as small multiples (one chart each), never as
// overlaid lines — categories are not compared with each other.
//
// points: [{ date: 'YYYY-MM-DD', value: number }], sorted by date.
// reference: optional { value, label } horizontal line (e.g. the 1000 start).

const W = 320;
const PAD = { top: 12, right: 44, bottom: 22, left: 36 };
const PLOT_W = W - PAD.left - PAD.right;

const fmtDay = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const defaultFormat = (v) => String(Math.round(v));

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

export function LineChart({
  points = [],
  label,
  color = 'var(--color-primary)',
  format = defaultFormat,
  reference = null,
  height = 168,
  emptyText = 'Pas encore de données.',
}) {
  const [hover, setHover] = useState(null);
  const [table, setTable] = useState(false);
  const svgRef = useRef(null);
  const PLOT_H = height - PAD.top - PAD.bottom;

  const geo = useMemo(() => {
    if (points.length === 0) return null;
    const xs = points.map((p) => Date.parse(p.date));
    const ys = points.map((p) => p.value);
    const values = reference ? [...ys, reference.value] : ys;
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    const pad = Math.max(1, (hi - lo) * 0.1);
    const ticks = niceTicks(lo - pad, hi + pad);
    const yMin = Math.min(ticks[0], lo);
    const yMax = Math.max(ticks.at(-1), hi);
    const xMin = Math.min(...xs);
    const xMax = Math.max(...xs);

    const x = (t) => (xMax === xMin ? PAD.left + PLOT_W : PAD.left + ((t - xMin) / (xMax - xMin)) * PLOT_W);
    const y = (v) => PAD.top + PLOT_H - ((v - yMin) / (yMax - yMin || 1)) * PLOT_H;
    const pts = points.map((p, i) => ({ ...p, cx: x(xs[i]), cy: y(p.value) }));
    return { pts, ticks, y, yMin, yMax };
  }, [points, reference, PLOT_H]);

  if (!geo) {
    return <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', margin: 0 }}>{emptyText}</p>;
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
          viewBox={`0 0 ${W} ${height}`}
          width="100%"
          role="img"
          aria-label={`${label} dans le temps`}
          style={{ display: 'block', touchAction: 'pan-y' }}
          onPointerMove={onMove}
          onPointerDown={onMove}
          onPointerLeave={() => setHover(null)}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--color-border)" strokeWidth="1" />
              <text
                x={PAD.left - 6} y={y(t) + 3} textAnchor="end" fontSize="9" fill="var(--color-text-muted)"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {format(t)}
              </text>
            </g>
          ))}

          {/* Reference value: a line, not a series — muted ink, labelled. */}
          {reference && reference.value >= geo.yMin && reference.value <= geo.yMax && (
            <g>
              <line
                x1={PAD.left} x2={W - PAD.right} y1={y(reference.value)} y2={y(reference.value)}
                stroke="var(--color-text-subtle, var(--color-text-muted))" strokeWidth="1"
              />
              <text x={W - PAD.right + 4} y={y(reference.value) + 3} fontSize="9" fill="var(--color-text-muted)">
                {reference.label}
              </text>
            </g>
          )}

          <path d={area} fill={color} opacity="0.1" />
          <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

          {active && (
            <line x1={active.cx} x2={active.cx} y1={PAD.top} y2={PAD.top + PLOT_H} stroke="var(--color-text-muted)" strokeWidth="1" />
          )}

          {/* End marker + the one direct label; the axis carries the rest. */}
          <circle cx={last.cx} cy={last.cy} r="4.5" fill={color} stroke="var(--color-surface)" strokeWidth="2" />
          {/* Above the dot, unless the dot sits at the top edge: then below it. */}
          <text
            x={Math.min(last.cx + 8, W - PAD.right + 2)} y={last.cy < PAD.top + 12 ? last.cy + 16 : last.cy - 8}
            fontSize="10" fontWeight="700" fill="var(--color-text)"
          >
            {format(last.value)}
          </text>

          {active && active !== last && (
            <circle cx={active.cx} cy={active.cy} r="4.5" fill={color} stroke="var(--color-surface)" strokeWidth="2" />
          )}

          <text x={PAD.left} y={height - 6} fontSize="9" fill="var(--color-text-muted)">{fmtDay(pts[0].date)}</text>
          {pts.length > 1 && (
            <text x={W - PAD.right} y={height - 6} textAnchor="end" fontSize="9" fill="var(--color-text-muted)">
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
              background: 'var(--color-surface-raised)', border: '1px solid var(--color-border-strong)',
              borderRadius: 'var(--radius-sm)', padding: '4px 8px',
              fontSize: 'var(--text-xs)', whiteSpace: 'nowrap',
            }}
          >
            <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{format(active.value)}</strong>
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
              <th style={{ fontWeight: 600, padding: '4px 0', textAlign: 'right' }}>{label}</th>
            </tr>
          </thead>
          <tbody>
            {[...pts].reverse().map((p, i) => (
              <tr key={`${p.date}-${i}`} style={{ borderTop: '1px solid var(--color-border)' }}>
                <td style={{ padding: '4px 0' }}>{p.date}</td>
                <td style={{ padding: '4px 0', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{format(p.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
