import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { Celebration, Toast } from './Celebration.jsx';
import { celebrationFor } from '../lib/home.js';

const TOGGLE = { task: api.toggleTask, habit: api.toggleHabit, milestone: api.toggleMilestone };

// Tick / untick a task, a routine session or a milestone from any screen,
// then show the right feedback: a toast for a plain tick, a full-screen
// celebration for a step, a held week, a milestone, a boss or a level.
// `user` is the profile before the toggle; `setState` receives the new home
// state. `onDone` runs after a successful toggle (e.g. reload a goal).
export function useTaskToggle({ user, setState, onDone }) {
  const [busy, setBusy] = useState(null);
  const [celebration, setCelebration] = useState(null);
  const [toast, setToast] = useState(null);
  const [error, setError] = useState(null);
  const toastTimer = useRef(null);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  // `target` = { type: 'task' | 'habit' | 'milestone', id }; busy holds its key.
  async function toggle(target, { goalTitle, stepTitle }) {
    if (busy) return;
    setBusy(`${target.type}:${target.id}`);
    setError(null);
    try {
      const r = await TOGGLE[target.type](target.id);
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
  const isBusy = (type, id) => busy === `${type}:${id}`;
  return { toggle, busy, isBusy, error, overlay };
}
