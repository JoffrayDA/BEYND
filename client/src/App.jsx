import React, { useEffect, useState, useCallback } from 'react';
import { api } from './api.js';
import { Onboarding } from './screens/Onboarding.jsx';
import { Chat } from './screens/Chat.jsx';
import { Log } from './screens/Log.jsx';

// coach_id already matches the design-system theme id (cool-jeune | pote-cash | data-nerd)
function applyTheme(coachId) {
  document.documentElement.dataset.theme = coachId || 'cool-jeune';
}

export function App() {
  const [state, setState] = useState(null);
  const [tab, setTab] = useState('chat');

  const refresh = useCallback(async () => {
    const s = await api.state();
    setState(s);
    applyTheme(s.project?.coach_id);
    return s;
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

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
      </div>
      <nav className="tabbar">
        <button data-active={tab === 'chat'} onClick={() => setTab('chat')}>Chat</button>
        <button data-active={tab === 'log'} onClick={() => setTab('log')}>Log</button>
      </nav>
    </div>
  );
}
