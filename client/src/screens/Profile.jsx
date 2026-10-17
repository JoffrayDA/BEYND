import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Button, Card } from '../ds.js';
import { Avatar, Flame } from '../components/Avatar.jsx';
import { Meter, PixelLabel, StatTile } from '../components/Stats.jsx';
import { Wordmark } from '../components/Wordmark.jsx';
import { fmtElo } from '../lib/home.js';
import { profileStats } from '../lib/profile.js';
import { Screen } from './Screen.jsx';

const fr = new Intl.NumberFormat('fr-FR');

// Character sheet (level, total XP, records) and the few settings the MVP has.
export function Profile({ state, onLogout }) {
  const { user } = state;
  const [data, setData] = useState({});
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    Promise.all([api.goals(), api.goals({ archived: true }), api.progress()])
      .then(([a, b, progress]) => setData({ active: a.goals, archived: b.goals, progress }))
      .catch(() => setData({}));
  }, []);
  const s = profileStats(data);

  async function logout() {
    setLeaving(true);
    try { await api.logout(); } finally { onLogout(); }
  }

  return (
    <Screen title="Profil">
      <Card padding="16px">
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <Avatar level={user.level} size={80} />
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
