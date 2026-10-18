import React, { useEffect, useState, useCallback } from 'react';
import { api, AUTH_EVENT } from './api.js';
import { Home } from './screens/Home.jsx';
import { Goals } from './screens/Goals.jsx';
import { Progress } from './screens/Progress.jsx';
import { Profile } from './screens/Profile.jsx';
import { Login } from './screens/Login.jsx';
import { Wordmark } from './components/Wordmark.jsx';
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
  const [locked, setLocked] = useState(false);          // server wants a password
  const [tab, setTab] = useState('home');
  // Another tab can send the Goals tab straight to creation or to one goal.
  const [goalsIntent, setGoalsIntent] = useState({});
  const go = (id, intent = {}) => { setGoalsIntent(intent); setTab(id); };

  const refresh = useCallback(async () => {
    try {
      const s = await api.state();
      setState(s);
      setError(null);
      setLocked(false);
      return s;
    } catch (err) {
      if (err.status !== 401) setError(err);
      return null;
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Any 401 (no session yet, or it expired) shows the login screen.
  useEffect(() => {
    const onAuth = () => setLocked(true);
    window.addEventListener(AUTH_EVENT, onAuth);
    return () => window.removeEventListener(AUTH_EVENT, onAuth);
  }, []);

  if (locked) return <Login onDone={refresh} />;

  if (!state) {
    return (
      <div className="app-frame" style={{ padding: 24, gap: 12 }}>
        <Wordmark />
        {error ? (
          <>
            <p style={{ margin: 0 }}>Serveur injoignable.</p>
            <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
              Lance <code>npm start</code> dans <code>server/</code>, puis réessaie.
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
        {tab === 'home' && <Home state={state} setState={setState} onNewGoal={() => go('goals', { create: true })} onOpenGoal={(id) => go('goals', { open: id })} />}
        {tab === 'goals' && <Goals key={JSON.stringify(goalsIntent)} state={state} setState={setState} refresh={refresh} intent={goalsIntent} />}
        {tab === 'progress' && <Progress />}
        {tab === 'profile' && <Profile state={state} setState={setState} onLogout={() => { setState(null); setLocked(true); setTab('home'); }} />}
      </main>
      <nav className="tabbar" aria-label="Navigation principale">
        {TABS.map(([id, label]) => (
          <button key={id} data-active={tab === id} aria-current={tab === id ? 'page' : undefined} onClick={() => go(id)}>
            <PixelIcon name={id} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
