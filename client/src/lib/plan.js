// Editing a coach proposal before it is saved. Pure functions only (no React),
// so the rules are unit-tested with node:test. Game rules come straight from
// the server's engine — one source of truth for gain, tiers and limits.

import {
  gain, tier, taskXp, clampDifficulty, round1, MAX_STEPS, MAX_TASKS,
  DIFFICULTY_MIN, DIFFICULTY_MAX, MAX_HABITS, MAX_MILESTONES,
  PER_WEEK_MIN, PER_WEEK_MAX, PER_WEEK_DEFAULT, BOSS_WEEKS_MIN, BOSS_WEEKS_MAX, BOSS_WEEKS_DEFAULT,
  MILESTONE_XP_FACTOR,
} from '../../../server/engine.js';

export {
  MAX_STEPS, MAX_TASKS, DIFFICULTY_MIN, DIFFICULTY_MAX, MAX_HABITS, MAX_MILESTONES,
  PER_WEEK_MIN, PER_WEEK_MAX, BOSS_WEEKS_MIN, BOSS_WEEKS_MAX,
};
export const MAX_TITLE = 80;
export const MAX_LABEL = 160;

// Stable React keys for rows the user adds, removes and edits.
let seq = 0;
const key = () => `k${++seq}`;

const task = (label = '') => ({ key: key(), label });
const step = (title = '', labels = ['']) => ({ key: key(), title, tasks: labels.map(task) });
const habit = (label = '', perWeek = PER_WEEK_DEFAULT) => ({ key: key(), label, per_week: perWeek });
const milestone = (label = '') => ({ key: key(), label });
const clampInt = (v, min, max) => Math.min(max, Math.max(min, Math.round(Number(v)) || min));

// Response of POST /goals/analyze → editable draft. Both shapes are kept, so
// switching between project and routine in the preview loses nothing.
export function fromAnalysis({ prompt, proposal }) {
  const routine = proposal.kind === 'routine';
  return {
    prompt,
    kind: routine ? 'routine' : 'project',
    title: proposal.title,
    category: proposal.category,
    difficulty: proposal.difficulty,
    coachDifficulty: proposal.difficulty,
    intro: proposal.intro,
    steps: routine ? [step()] : proposal.steps.map((s) => step(s.title, s.tasks)),
    habits: routine ? proposal.habits.map((h) => habit(h.label, h.per_week)) : [habit()],
    milestones: routine ? proposal.milestones.map(milestone) : [],
    bossWeeks: routine ? proposal.boss_weeks : BOSS_WEEKS_DEFAULT,
  };
}

const mapHabit = (draft, habitKey, fn) => ({
  ...draft,
  habits: draft.habits.map((h) => (h.key === habitKey ? fn(h) : h)),
});

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
    case 'kind':
      return { ...draft, kind: action.value === 'routine' ? 'routine' : 'project' };
    case 'habitLabel':
      return mapHabit(draft, action.habit, (h) => ({ ...h, label: action.value.slice(0, MAX_LABEL) }));
    case 'habitPerWeek':
      return mapHabit(draft, action.habit, (h) => ({ ...h, per_week: clampInt(action.value, PER_WEEK_MIN, PER_WEEK_MAX) }));
    case 'addHabit':
      if (draft.habits.length >= MAX_HABITS) return draft;
      return { ...draft, habits: [...draft.habits, habit()] };
    case 'removeHabit':
      if (draft.habits.length <= 1) return draft;
      return { ...draft, habits: draft.habits.filter((h) => h.key !== action.habit) };
    case 'milestoneLabel':
      return {
        ...draft,
        milestones: draft.milestones.map((m) => (m.key === action.milestone ? { ...m, label: action.value.slice(0, MAX_TITLE) } : m)),
      };
    case 'addMilestone':
      if (draft.milestones.length >= MAX_MILESTONES) return draft;
      return { ...draft, milestones: [...draft.milestones, milestone()] };
    case 'removeMilestone':
      return { ...draft, milestones: draft.milestones.filter((m) => m.key !== action.milestone) };
    case 'bossWeeks':
      return { ...draft, bossWeeks: clampInt(action.value, BOSS_WEEKS_MIN, BOSS_WEEKS_MAX) };
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
  const base = { title: clean(draft.title), category: draft.category, difficulty: draft.difficulty, intro: draft.intro };
  if (draft.kind === 'routine') {
    return {
      prompt: draft.prompt,
      proposal: {
        kind: 'routine',
        ...base,
        habits: draft.habits
          .map((h) => ({ label: clean(h.label), per_week: h.per_week }))
          .filter((h) => h.label),
        milestones: draft.milestones.map((m) => clean(m.label)).filter(Boolean),
        boss_weeks: draft.bossWeeks,
      },
    };
  }
  return {
    prompt: draft.prompt,
    proposal: {
      kind: 'project',
      ...base,
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
  if (draft.kind === 'routine') {
    if (toRequest(draft).proposal.habits.length === 0) errors.push('Garde au moins une habitude.');
    return errors;
  }
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
  const W = draft.habits.reduce((a, h) => a + (clean(h.label) ? h.per_week : 0), 0);
  return {
    tier: { id: t.id, label: t.label },
    xpPerTask: taskXp(draft.difficulty),
    xpPerMilestone: taskXp(draft.difficulty) * MILESTONE_XP_FACTOR,
    categoryElo: elo,
    stepGain: g,
    bossGain: g * 2,
    // Routine: one session, a held week (bonus), all sessions per week.
    sessionsPerWeek: W,
    sessionGain: W ? round1(g / W) : 0,
  };
}
