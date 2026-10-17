// Editing a coach proposal before it is saved. Pure functions only (no React),
// so the rules are unit-tested with node:test. Game rules come straight from
// the server's engine — one source of truth for gain, tiers and limits.

import {
  gain, tier, taskXp, clampDifficulty, MAX_STEPS, MAX_TASKS,
  DIFFICULTY_MIN, DIFFICULTY_MAX,
} from '../../../server/engine.js';

export { MAX_STEPS, MAX_TASKS, DIFFICULTY_MIN, DIFFICULTY_MAX };
export const MAX_TITLE = 80;
export const MAX_LABEL = 160;

// Stable React keys for rows the user adds, removes and edits.
let seq = 0;
const key = () => `k${++seq}`;

const task = (label = '') => ({ key: key(), label });
const step = (title = '', labels = ['']) => ({ key: key(), title, tasks: labels.map(task) });

// Response of POST /goals/analyze → editable draft.
export function fromAnalysis({ prompt, proposal }) {
  return {
    prompt,
    title: proposal.title,
    category: proposal.category,
    difficulty: proposal.difficulty,
    coachDifficulty: proposal.difficulty,
    intro: proposal.intro,
    steps: proposal.steps.map((s) => step(s.title, s.tasks)),
  };
}

const mapStep = (draft, stepKey, fn) => ({
  ...draft,
  steps: draft.steps.map((s) => (s.key === stepKey ? fn(s) : s)),
});

export function planReducer(draft, action) {
  switch (action.type) {
    case 'title':
      return { ...draft, title: action.value.slice(0, MAX_TITLE) };
    case 'category':
      return { ...draft, category: action.value };
    case 'difficulty':
      return { ...draft, difficulty: clampDifficulty(Number(action.value)) };
    case 'stepTitle':
      return mapStep(draft, action.step, (s) => ({ ...s, title: action.value.slice(0, MAX_TITLE) }));
    case 'addStep':
      if (draft.steps.length >= MAX_STEPS) return draft;
      return { ...draft, steps: [...draft.steps, step()] };
    case 'removeStep':
      if (draft.steps.length <= 1) return draft;
      return { ...draft, steps: draft.steps.filter((s) => s.key !== action.step) };
    case 'taskLabel':
      return mapStep(draft, action.step, (s) => ({
        ...s,
        tasks: s.tasks.map((t) => (t.key === action.task ? { ...t, label: action.value.slice(0, MAX_LABEL) } : t)),
      }));
    case 'addTask':
      return mapStep(draft, action.step, (s) => (s.tasks.length >= MAX_TASKS ? s : { ...s, tasks: [...s.tasks, task()] }));
    case 'removeTask':
      return mapStep(draft, action.step, (s) => (s.tasks.length <= 1 ? s : { ...s, tasks: s.tasks.filter((t) => t.key !== action.task) }));
    default:
      throw new Error(`unknown action ${action.type}`);
  }
}

const clean = (s) => s.replace(/\s+/g, ' ').trim();

// Draft → body of POST /goals. Blank rows are dropped, like the server does.
export function toRequest(draft) {
  return {
    prompt: draft.prompt,
    proposal: {
      title: clean(draft.title),
      category: draft.category,
      difficulty: draft.difficulty,
      intro: draft.intro,
      steps: draft.steps
        .map((s) => ({ title: clean(s.title), tasks: s.tasks.map((t) => clean(t.label)).filter(Boolean) }))
        .filter((s) => s.title && s.tasks.length > 0),
    },
  };
}

// What blocks saving, as messages for the user. Empty = ready.
export function draftErrors(draft) {
  const errors = [];
  if (!clean(draft.title)) errors.push('Donne un titre à ton objectif.');
  const { steps } = toRequest(draft).proposal;
  if (steps.length === 0) errors.push('Garde au moins une étape avec un titre et une tâche.');
  const halfEmpty = draft.steps.some((s) => !clean(s.title) && s.tasks.some((t) => clean(t.label)));
  if (halfEmpty) errors.push('Une étape a des tâches mais pas de titre.');
  return errors;
}

// What the goal is worth at the user's current Elo in that category.
export function preview(draft, categories) {
  const elo = categories.find((c) => c.id === draft.category)?.elo ?? 1000;
  const g = gain(draft.difficulty, elo);
  const t = tier(draft.difficulty);
  return {
    tier: { id: t.id, label: t.label },
    xpPerTask: taskXp(draft.difficulty),
    categoryElo: elo,
    stepGain: g,
    bossGain: g * 2,
  };
}
