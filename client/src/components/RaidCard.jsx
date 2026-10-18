import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Button, Card } from '../ds.js';
import { PixelArt } from './PixelArt.jsx';
import { monsterLayers } from './sprites.js';
import { Meter, PixelLabel } from './Stats.jsx';
import { Celebration } from './Celebration.jsx';
import { raidCard } from '../lib/raid.js';
import { celebrationFor } from '../lib/home.js';

// The monster of the week on the Home screen: charge during the week, the
// assault on Sunday, then its HP until it falls (or flees on Monday).
export function RaidCard({ raid, today, user, setState }) {
  const [assault, setAssault] = useState(null);         // { before, after, events }
  const [celebration, setCelebration] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const c = raidCard(raid, today);

  async function launch() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api.assault();
      setAssault({ before: raid, after: r.raid, events: r.events, state: r.state });
    } catch {
      setError('L’assaut n’a pas pu être lancé. Réessaie.');
    } finally {
      setBusy(false);
    }
  }

  function closeAssault() {
    const { events, state } = assault;
    setAssault(null);
    setState((s) => ({ ...s, ...state }));
    const won = celebrationFor({ events, before: user, after: state.user });
    if (won.kind === 'raid') setCelebration(won);
  }

  const won = raid.status === 'won';
  return (
    <Card padding="14px" style={{ borderColor: c.canAssault ? 'var(--elo-pink)' : undefined }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <div className="raid-monster" data-won={won} style={{ flex: 'none' }}>
          <PixelArt layers={monsterLayers(raid.species)} size={64} label={raid.name} />
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
            <PixelLabel color="var(--elo-pink)">Raid · {c.label}</PixelLabel>
            <PixelLabel>{raid.hp_left}/{raid.hp} PV</PixelLabel>
          </div>
          <div style={{ fontWeight: 800 }}>{raid.name}</div>
          <Meter pct={c.hpPct} color="var(--elo-pink)" height={8} label={`Points de vie de ${raid.name}`} />
          {c.showCharge && (
            <>
              <Meter pct={c.chargePct} color="var(--elo-gold)" height={6} label="Charge de ton arme" />
              <PixelLabel color="var(--elo-gold)">Arme : {raid.charge} dégâts</PixelLabel>
            </>
          )}
        </div>
      </div>
      <p style={{ margin: '10px 0 0', fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>{c.line}</p>
      {!won && (
        <p style={{ margin: '4px 0 0', fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)' }}>
          Récompense : {raid.reward.name.toLowerCase()}, un trophée et +{raid.bonus_xp} XP.
        </p>
      )}
      {c.canAssault && (
        <div style={{ marginTop: 12 }}>
          <Button onClick={launch} disabled={busy}>{busy ? 'Assaut…' : 'Lancer l’assaut'}</Button>
        </div>
      )}
      {error && <p role="alert" className="error" style={{ marginTop: 8 }}>{error}</p>}
      {assault && <AssaultOverlay {...assault} onClose={closeAssault} />}
      {celebration && <Celebration c={celebration} onClose={() => setCelebration(null)} />}
    </Card>
  );
}

// The assault: the monster shakes, the charge lands as one big number and
// its HP bar drains. Reduced motion keeps only the end state.
function AssaultOverlay({ before, after, onClose }) {
  const [hit, setHit] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setHit(true), 300);
    const onKey = (e) => { if (e.key === 'Escape' || e.key === 'Enter') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { clearTimeout(t); window.removeEventListener('keydown', onKey); };
  }, [onClose]);

  const left = hit ? after.hp_left : before.hp_left;
  const done = after.status === 'won';
  return (
    <div className="celebration" role="dialog" aria-modal="true" aria-labelledby="assault-title" onClick={onClose}>
      <div className="celebration-card" style={{ borderColor: 'var(--elo-pink)' }} onClick={(e) => e.stopPropagation()}>
        <PixelLabel color="var(--elo-pink)">Assaut</PixelLabel>
        <h2 id="assault-title" style={{ margin: '6px 0 10px', fontSize: 'var(--text-xl)', fontWeight: 800 }}>{after.name}</h2>
        <div style={{ position: 'relative', display: 'grid', placeItems: 'center', height: 120 }}>
          <div className={hit ? 'raid-shake' : undefined} data-won={hit && done}>
            <PixelArt layers={monsterLayers(after.species)} size={112} label={after.name} />
          </div>
          {hit && <span className="raid-hit" aria-hidden>−{after.damage}</span>}
        </div>
        <Meter pct={(left / after.hp) * 100} color="var(--elo-pink)" height={10} label={`Points de vie de ${after.name}`} />
        <p role="status" style={{ margin: '10px 0 0', fontSize: 'var(--text-sm)' }}>
          {!hit ? 'Ton arme frappe…'
            : done ? `${after.damage} dégâts : il tombe !`
              : after.damage === 0 ? 'Ton arme n’était pas chargée. Coche tes tâches du jour pour le frapper.'
                : `${after.damage} dégâts. Il lui reste ${after.hp_left} PV : chaque coche d’aujourd’hui le frappe encore.`}
        </p>
        <div style={{ marginTop: 16 }}><Button onClick={onClose}>Continuer</Button></div>
      </div>
    </div>
  );
}
