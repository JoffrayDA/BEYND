import React, { useEffect } from 'react';
import { Button } from '../ds.js';
import { PixelLabel } from './Stats.jsx';
import { fmtGain } from '../lib/home.js';

const ACCENT = { step: 'var(--color-primary)', boss: 'var(--elo-pink)', level: 'var(--elo-gold)', raid: 'var(--elo-pink)' };
const KICKER = { boss: 'Objectif terminé', step: 'Jalon', level: 'Level up', raid: 'Raid du dimanche' };
const CONFETTI = ['var(--elo-green)', 'var(--elo-gold)', 'var(--elo-pink)', 'var(--elo-blue)', 'var(--elo-orange)'];

// Full-screen moment for a finished step, a defeated boss or a level-up.
// Fun stays in touches: pixel confetti + one card, dismissed with one tap.
export function Celebration({ c, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' || e.key === 'Enter') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const accent = ACCENT[c.kind];
  return (
    <div className="celebration" role="dialog" aria-modal="true" aria-labelledby="celebration-title" onClick={onClose}>
      <div aria-hidden className="confetti">
        {Array.from({ length: 24 }, (_, i) => (
          <span key={i} style={{
            left: `${(i * 37) % 100}%`, background: CONFETTI[i % CONFETTI.length],
            animationDelay: `${(i % 6) * 0.12}s`, animationDuration: `${1.6 + (i % 4) * 0.3}s`,
          }} />
        ))}
      </div>
      <div className="celebration-card" style={{ borderColor: accent }} onClick={(e) => e.stopPropagation()}>
        <PixelLabel color={accent}>{KICKER[c.kind]}</PixelLabel>
        <h2 id="celebration-title" style={{ margin: '6px 0 2px', fontSize: 'var(--text-2xl)', fontWeight: 800 }}>{c.title}</h2>
        {c.subtitle && <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>{c.subtitle}</p>}
        {c.kind !== 'level' && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 24, margin: '16px 0 4px' }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 'var(--text-3xl)' }}>{fmtGain(c.elo)}</div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                {c.kind === 'raid' ? 'Elo (le raid n’en donne pas)' : `Elo (dont bonus ${fmtGain(c.bonus)})`}
              </div>
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 'var(--text-3xl)' }}>+{c.xp}</div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>XP</div>
            </div>
          </div>
        )}
        {c.reward && (
          <p style={{ margin: '8px 0 0', fontSize: 'var(--text-sm)' }}>
            Nouvel accessoire : <strong>{c.reward.name}</strong>. Équipe-le dans ton Profil.
          </p>
        )}
        {c.levelUp && c.kind !== 'level' && <PixelLabel color="var(--elo-gold)">Niveau {c.levelUp} atteint</PixelLabel>}
        <div style={{ marginTop: 16 }}><Button onClick={onClose}>Continuer</Button></div>
      </div>
    </div>
  );
}

// Short feedback for a plain tick / untick, above the tab bar.
export function Toast({ c }) {
  const up = c.elo >= 0;
  return (
    <div className="toast" role="status">
      <span style={{ color: up ? 'var(--color-up)' : 'var(--color-down)', fontWeight: 700 }}>{fmtGain(c.elo)} Elo</span>
      <span style={{ color: 'var(--color-text-muted)' }}>·</span>
      <PixelLabel color="var(--elo-gold)">{c.xp >= 0 ? '+' : '−'}{Math.abs(c.xp)} XP</PixelLabel>
    </div>
  );
}
