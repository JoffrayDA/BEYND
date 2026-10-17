import { test } from 'node:test';
import assert from 'node:assert/strict';
import { categoryFilters, filterGoals, taskGain, currentStepIndex } from './goals.js';

const cats = [{ id: 'tech', name: 'Tech' }, { id: 'langues', name: 'Langues' }, { id: 'sport', name: 'Sport' }];
const goals = [{ id: 1, category_id: 'sport' }, { id: 2, category_id: 'tech' }, { id: 3, category_id: 'tech' }];

test('categoryFilters: "Tous" first, then non-empty categories in fixed order with counts', () => {
  assert.deepEqual(categoryFilters(goals, cats), [
    { id: null, name: 'Tous', count: 3 },
    { id: 'tech', name: 'Tech', count: 2 },
    { id: 'sport', name: 'Sport', count: 1 },
  ]);
  assert.deepEqual(categoryFilters([], cats), [{ id: null, name: 'Tous', count: 0 }]);
});

test('filterGoals: null keeps everything', () => {
  assert.equal(filterGoals(goals, null).length, 3);
  assert.deepEqual(filterGoals(goals, 'tech').map((g) => g.id), [2, 3]);
});

test('taskGain: gain / n at the current Elo, 0.1 precision', () => {
  assert.equal(taskGain(1850, 1000, 5), 21);     // gain 105
  assert.equal(taskGain(450, 1050, 3), 0.7);     // gain floor 2
  assert.equal(taskGain(1850, 1000, 0), 105);    // never divides by 0
});

test('currentStepIndex: first step not done, -1 when all are', () => {
  assert.equal(currentStepIndex([{ status: 'done' }, { status: 'todo' }, { status: 'todo' }]), 1);
  assert.equal(currentStepIndex([{ status: 'done' }]), -1);
});

test('routineLine: week progress, run of weeks, boss', async () => {
  const { routineLine } = await import('./goals.js');
  const r = (o) => ({ week: { done: 3, target: 5 }, weeks_streak: 0, boss_done: false, ...o });
  assert.equal(routineLine(r()), 'Cette semaine 3/5');
  assert.equal(routineLine(r({ weeks_streak: 1 })), 'Cette semaine 3/5 · 1 semaine d’affilée');
  assert.equal(routineLine(r({ weeks_streak: 8, boss_done: true })), 'Cette semaine 3/5 · 8 semaines d’affilée · boss vaincu');
});
