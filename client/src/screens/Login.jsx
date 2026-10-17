import React, { useState } from 'react';
import { api } from '../api.js';
import { Button } from '../ds.js';
import { Wordmark } from '../components/Wordmark.jsx';

// Shown when the server has APP_PASSWORD set and there is no valid session.
export function Login({ onDone }) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    if (busy || !password) return;
    setBusy(true);
    setError(null);
    try {
      await api.login(password);
      await onDone();
    } catch (err) {
      setError(err.status === 401 ? 'Mot de passe incorrect.'
        : err.status === 429 ? 'Trop d’essais. Réessaie dans un quart d’heure.'
          : 'Serveur injoignable. Réessaie.');
      setBusy(false);
    }
  }

  return (
    <div className="app-frame" style={{ padding: 24, justifyContent: 'center', gap: 24 }}>
      <Wordmark size={40} sub="Tes objectifs de vie, un Elo par catégorie." />
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="form-row">
          <label htmlFor="password">Mot de passe</label>
          <input id="password" className="field" type="password" autoComplete="current-password" autoFocus
            value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <p role="alert" className="error" style={{ margin: 0 }}>{error}</p>}
        <Button type="submit" disabled={busy || !password}>{busy ? 'Connexion…' : 'Entrer'}</Button>
      </form>
    </div>
  );
}
