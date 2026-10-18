import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Button, Card } from '../ds.js';
import { Avatar, Flame } from '../components/Avatar.jsx';
import { Meter, PixelLabel, StatTile } from '../components/Stats.jsx';
import { Wordmark } from '../components/Wordmark.jsx';
import { fmtElo } from '../lib/home.js';
import { profileStats } from '../lib/profile.js';
import { gearSlots } from '../lib/raid.js';
import { PixelArt } from '../components/PixelArt.jsx';
import { monsterLayers } from '../components/sprites.js';
import { Screen } from './Screen.jsx';

const fr = new Intl.NumberFormat('fr-FR');

// Character sheet (level, total XP, records) and the few settings the MVP has.
export function Profile({ state, setState, onLogout }) {
  const { user } = state;
  const [data, setData] = useState({});
  const [raids, setRaids] = useState(null);           // { trophies, fled, owned, gear }
  const [leaving, setLeaving] = useState(false);
  const [equipping, setEquipping] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([api.goals(), api.goals({ archived: true }), api.progress()])
      .then(([a, b, progress]) => setData({ active: a.goals, archived: b.goals, progress }))
      .catch(() => setData({}));
    api.raids().then(setRaids).catch(() => setRaids(null));
  }, []);
  const s = profileStats(data);

  // Tapping the equipped item takes it off; another item replaces it.
  async function equip(slot, item) {
    if (equipping) return;
    setEquipping(slot);
    setError(null);
    try {
      const r = await api.equip(slot, user.gear?.[slot] === item ? null : item);
      setState((st) => ({ ...st, ...r.state }));
    } catch {
      setError('L’équipement n’a pas pu être changé. Réessaie.');
    } finally {
      setEquipping(null);
    }
  }

  async function logout() {
    setLeaving(true);
    try { await api.logout(); } finally { onLogout(); }
  }

  return (
    <Screen title="Profil">
      <Card padding="16px">
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <Avatar level={user.level} size={80} gear={user.gear} />
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontWeight: 800, fontSize: 'var(--text-lg)' }}>{user.name}</div>
            <PixelLabel color="var(--elo-gold)" style={{ fontSize: 12 }}>Niv. {user.level}</PixelLabel>
            <Meter pct={(user.xpInLevel / user.xpForNext) * 100} color="var(--elo-gold)" label="XP du niveau" />
            <PixelLabel>{fr.format(user.xp)} XP au total</PixelLabel>
          </div>
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <StatTile label="Elo de vie" value={fmtElo(state.life_elo.value)} sub="moyenne de tes catégories" />
        <StatTile label="Série" value={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Flame lit={user.streak > 0} size={16} />{user.streak} j</span>}
          sub={`record : ${s.bestStreak} j`} />
        <StatTile label="Objectifs en cours" value={s.inProgress} sub={`dont ${s.routines} routine${s.routines > 1 ? 's' : ''}`} />
        <StatTile label="Boss vaincus" value={s.bosses} sub={`${s.activeDays} jour${s.activeDays > 1 ? 's' : ''} d’activité`} />
      </div>

      {raids && raids.owned.length > 0 && (
        <section aria-labelledby="gear-title" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h2 id="gear-title" style={{ margin: 0, fontSize: 'var(--text-lg)' }}>Équipement</h2>
          {gearSlots(raids.owned, user.gear).map((g) => (
            <div key={g.slot} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 76, flex: 'none', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{g.label}</span>
              <div className="chip-row" role="group" aria-label={`Équipement : ${g.label}`} style={{ margin: 0, padding: 0 }}>
                {g.items.map((it) => (
                  <button key={it.id} className="chip" aria-pressed={g.equipped === it.id} disabled={equipping != null}
                    onClick={() => equip(g.slot, it.id)}>
                    {it.name}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {error && <p role="alert" className="error" style={{ margin: 0 }}>{error}</p>}
        </section>
      )}

      {raids && (
        <section aria-labelledby="trophies-title" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <h2 id="trophies-title" style={{ margin: 0, fontSize: 'var(--text-lg)' }}>Trophées de raid</h2>
            <PixelLabel>{raids.trophies.length} vaincu{raids.trophies.length > 1 ? 's' : ''} · {raids.fled} enfui{raids.fled > 1 ? 's' : ''}</PixelLabel>
          </div>
          {raids.trophies.length === 0 ? (
            <Card padding="14px">
              <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
                Bats le monstre de la semaine dimanche pour gagner ton premier trophée et un accessoire.
              </p>
            </Card>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {raids.trophies.map((t) => (
                <Card key={t.week} padding="10px 6px" style={{ textAlign: 'center' }}>
                  <PixelArt layers={monsterLayers(t.species)} size={48} label={t.name} />
                  <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, marginTop: 4 }}>{t.name}</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)' }}>{fmtWeek(t.week)}</div>
                </Card>
              ))}
            </div>
          )}
        </section>
      )}

      <section aria-labelledby="settings-title" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h2 id="settings-title" style={{ margin: 0, fontSize: 'var(--text-lg)' }}>Réglages</h2>
        <Card padding="12px 14px">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 'var(--text-sm)' }}>
            <span>Coach</span>
            <span style={{ color: 'var(--color-text-muted)' }}>{state.hasKey ? 'Gemini' : 'Mode simulé (pas de clé)'}</span>
          </div>
        </Card>
        {state.auth && (
          <Button variant="secondary" disabled={leaving} onClick={logout}>{leaving ? 'Déconnexion…' : 'Se déconnecter'}</Button>
        )}
      </section>

      <div style={{ marginTop: 'auto', paddingTop: 16, opacity: 0.6 }}>
        <Wordmark size={18} sub="« Elo de vie » : ton score global, la moyenne de tes catégories." />
      </div>
    </Screen>
  );
}

const fmtDate = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
const fmtWeek = (monday) => `sem. du ${fmtDate.format(new Date(`${monday}T12:00:00`))}`;
