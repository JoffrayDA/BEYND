import React, { useEffect, useState, useCallback } from 'react';
import { api } from './api.js';
import { Home } from './screens/Home.jsx';
import { Placeholder } from './screens/Screen.jsx';
import { PixelIcon } from './components/PixelIcon.jsx';
import { Button } from './ds.js';

const TABS = [
  ['home', 'Accueil'],
  ['goals', 'Objectifs'],
  ['progress', 'Progrès'],
  ['profile', 'Profil'],
];

export function App() {
  const [state, setState] = useState(null);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('home');

  const refresh = useCallback(async () => {
    try {
      const s = await api.state();
      setState(s);
      setError(null);
      return s;
    } catch (err) {
      setError(err);
      return null;
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  if (!state) {
    return (
      <div className="app-frame" style={{ padding: 24, gap: 12 }}>
        {error ? (
          <>
            <p style={{ margin: 0 }}>Serveur injoignable.</p>
            <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
              Lance <code>npm run dev</code> dans <code>server/</code>, puis réessaie.
            </p>
            <div><Button onClick={refresh}>Réessayer</Button></div>
          </>
        ) : (
          <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>Chargement…</p>
        )}
      </div>
    );
  }

  return (
    <div className="app-frame">
      <main style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {tab === 'home' && <Home state={state} refresh={refresh} />}
        {tab === 'goals' && <Placeholder title="Objectifs" step="É6 et É8">Tes objectifs, filtrés par catégorie, avec difficulté et gain potentiel.</Placeholder>}
        {tab === 'progress' && <Placeholder title="Progrès" step="É8">Une courbe d'Elo par catégorie, l'historique et tes séries.</Placeholder>}
        {tab === 'profile' && <Placeholder title="Profil" step="É9">Ton personnage et tes réglages.</Placeholder>}
      </main>
      <nav className="tabbar" aria-label="Navigation principale">
        {TABS.map(([id, label]) => (
          <button key={id} data-active={tab === id} aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(id)}>
            <PixelIcon name={id} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
