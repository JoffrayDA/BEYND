import React from 'react';
import { avatarTier } from '../lib/home.js';
import { heroLayers } from './sprites.js';
import { PixelArt } from './PixelArt.jsx';

// 16×16 pixel adventurer (sprites.js). The tunic takes the tier colour of
// the level (blue → green → gold → pink), so progress shows on the character;
// accessories won in raids are drawn over it.
export function Avatar({ level = 1, size = 64, gear = {} }) {
  return (
    <div style={{
      width: size, height: size, flex: 'none', display: 'grid', placeItems: 'center',
      background: 'var(--color-border)', border: '1px solid var(--color-border-strong)', borderRadius: 'var(--radius-md)',
    }}>
      <PixelArt layers={heroLayers(gear, `var(--tier-${avatarTier(level)})`)} size={size * 0.8} label={`Ton personnage, niveau ${level}`} />
    </div>
  );
}

// Small pixel flame for the streak.
const FLAME = [
  '...#....',
  '..##....',
  '..###.#.',
  '.#####..',
  '.##o###.',
  '##ooo##.',
  '##ooo##.',
  '.#####..',
];

const filled = (x, y) => FLAME[y]?.[x] != null && FLAME[y][x] !== '.';
const isEdge = (x, y) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !filled(x + dx, y + dy));

// Lit: orange with a gold core. Out (no streak): outline only, muted — an
// empty flame reads as "not lit yet" rather than as a grey blob.
export function Flame({ lit = true, size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 8 8" shapeRendering="crispEdges" aria-hidden>
      {FLAME.flatMap((row, y) => [...row].map((c, x) => {
        if (c === '.' || (!lit && !isEdge(x, y))) return null;
        const fill = !lit ? 'var(--color-text-subtle)' : c === 'o' ? 'var(--elo-gold)' : 'var(--elo-orange)';
        return <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={fill} />;
      }))}
    </svg>
  );
}
