// Goals tab logic, pure (tested with node:test).
import { gain } from '../../../server/engine.js';

// Filter chips: "Tous" plus one per category that has goals in the list, in
// the fixed category order, each with its count. Empty categories get no chip.
export function categoryFilters(goals, categories) {
  const count = (id) => goals.filter((g) => g.category_id === id).length;
  return [
    { id: null, name: 'Tous', count: goals.length },
    ...categories.map((c) => ({ id: c.id, name: c.name, count: count(c.id) })).filter((c) => c.count > 0),
  ];
}

export const filterGoals = (goals, category) =>
  category ? goals.filter((g) => g.category_id === category) : goals;

// What ticking one task of a step would earn now: gain / n at the current Elo,
// rounded like the server (0.1).
export const taskGain = (difficulty, elo, taskCount) =>
  Math.round((gain(difficulty, elo) / Math.max(1, taskCount)) * 10) / 10;

// Index of the step the quest is working on (first not done), or -1 when all are.
export const currentStepIndex = (steps) => steps.findIndex((s) => s.status !== 'done');
