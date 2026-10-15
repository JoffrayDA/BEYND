import React, { useEffect, useState, useCallback, useRef } from 'react';
import { api } from './api.js';
import { Onboarding } from './screens/Onboarding.jsx';
import { Chat } from './screens/Chat.jsx';
import { Log } from './screens/Log.jsx';
import { Dashboard } from './screens/Dashboard.jsx';
import { History } from './screens/History.jsx';
import { Settings } from './screens/Settings.jsx';

const TABS = [
  ['chat', 'Chat'],
  ['log', 'Log'],
  ['stats', 'Stats'],
  ['histo', 'Historique'],
  ['reglages', 'Réglages'],
];

// coach_id already matches the design-system theme id (cool-jeune | pote-cash | data-nerd)
function applyTheme(coachId) {
  document.documentElement.dataset.theme = coachId || 'cool-jeune';
}

export function App() {
  const [state, setState] = useState(null);
  const [tab, setTab] = useState('chat');
  const checkinDone = useRef(false);

  const refresh = useCallback(async () => {
    const s = await api.state();
    setState(s);
    applyTheme(s.project?.coach_id);
    return s;
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Opening check-in: if the server says one is due (no weigh-in for a while,
  // or engagements lagging), let the coach open the chat. Once per app load.
  useEffect(() => {
    if (!state?.checkin?.raison || checkinDone.current) return;
    checkinDone.current = true;
    (async () => {
      try {
        const r = await api.checkin();
        if (r.fired) { setTab('chat'); await refresh(); }
      } catch { /* a failed check-in must never block the app */ }
    })();
  }, [state?.checkin?.raison, refresh]);

  if (!state) return <div className="app-frame" style={{ padding: 24 }}>Chargement…</div>;

  const active = state.project && state.project.statut === 'active';

  if (!active) {
    return (
      <div className="app-frame">
        <Onboarding state={state} onTheme={applyTheme} onDone={refresh} />
      </div>
    );
  }

  return (
    <div className="app-frame">
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {tab === 'chat' && <Chat state={state} refresh={refresh} onTheme={applyTheme} />}
        {tab === 'log' && <Log state={state} refresh={refresh} />}
        {tab === 'stats' && <Dashboard state={state} />}
        {tab === 'histo' && <History />}
        {tab === 'reglages' && <Settings state={state} refresh={refresh} onTheme={applyTheme} />}
      </div>
      <nav className="tabbar">
        {TABS.map(([id, label]) => (
          <button key={id} data-active={tab === id} onClick={() => setTab(id)}>{label}</button>
        ))}
      </nav>
    </div>
  );
}
