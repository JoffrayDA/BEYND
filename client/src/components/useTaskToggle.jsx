import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { Celebration, Toast } from './Celebration.jsx';
import { celebrationFor } from '../lib/home.js';

// Tick / untick a task from any screen, then show the right feedback: a toast
// for a plain tick, a full-screen celebration for a step, a boss or a level.
// `user` is the profile before the toggle; `setState` receives the new home
// state. `onDone` runs after a successful toggle (e.g. reload a goal).
export function useTaskToggle({ user, setState, onDone }) {
  const [busy, setBusy] = useState(null);
  const [celebration, setCelebration] = useState(null);
  const [toast, setToast] = useState(null);
  const [error, setError] = useState(null);
  const toastTimer = useRef(null);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  async function toggle(taskId, { goalTitle, stepTitle }) {
    if (busy) return;
    setBusy(taskId);
    setError(null);
    try {
      const r = await api.toggleTask(taskId);
      const c = celebrationFor({ events: r.events, before: user, after: r.state.user, goalTitle, stepTitle });
      setState((s) => ({ ...s, ...r.state }));
      await onDone?.();
      if (c.kind === 'toast') {
        setToast(c);
        clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setToast(null), 2200);
      } else {
        setToast(null);
        setCelebration(c);
      }
    } catch {
      setError('La tâche n’a pas pu être mise à jour. Réessaie.');
    } finally {
      setBusy(null);
    }
  }

  const overlay = (
    <>
      {toast && <Toast c={toast} />}
      {celebration && <Celebration c={celebration} onClose={() => setCelebration(null)} />}
    </>
  );
  return { toggle, busy, error, overlay };
}
