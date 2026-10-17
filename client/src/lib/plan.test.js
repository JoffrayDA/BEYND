import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fromAnalysis, planReducer, toRequest, draftErrors, preview, MAX_STEPS, MAX_TASKS } from './plan.js';

const analysis = {
  prompt: 'Devenir pentester',
  proposal: {
    title: 'Devenir pentester',
    category: 'tech',
    difficulty: 1850,
    intro: 'Six mois.',
    steps: [
      { title: 'Bases', tasks: ['Pre Security', 'Bandit 0-10'] },
      { title: 'Machines', tasks: ['Vulnversity'] },
    ],
  },
};
const cats = [{ id: 'tech', elo: 1000 }, { id: 'langues', elo: 980 }];

test('fromAnalysis → toRequest round-trips an untouched proposal', () => {
  const d = fromAnalysis(analysis);
  assert.equal(d.coachDifficulty, 1850);
  assert.deepEqual(toRequest(d), analysis);
  assert.deepEqual(draftErrors(d), []);
});

test('every row gets a unique key', () => {
  const d = fromAnalysis(analysis);
  const keys = d.steps.flatMap((s) => [s.key, ...s.tasks.map((t) => t.key)]);
  assert.equal(new Set(keys).size, keys.length);
});

test('edit title, category, difficulty (clamped)', () => {
  let d = fromAnalysis(analysis);
  d = planReducer(d, { type: 'title', value: 'Pentester junior' });
  d = planReducer(d, { type: 'category', value: 'langues' });
  d = planReducer(d, { type: 'difficulty', value: '9999' });
  assert.equal(d.title, 'Pentester junior');
  assert.equal(d.category, 'langues');
  assert.equal(d.difficulty, 2200);
  assert.equal(planReducer(d, { type: 'difficulty', value: 10 }).difficulty, 400);
});

test('add, edit and remove tasks; never below one per step', () => {
  let d = fromAnalysis(analysis);
  const s = d.steps[1];
  d = planReducer(d, { type: 'addTask', step: s.key });
  const added = d.steps[1].tasks[1];
  d = planReducer(d, { type: 'taskLabel', step: s.key, task: added.key, value: 'Kenobi' });
  assert.deepEqual(toRequest(d).proposal.steps[1].tasks, ['Vulnversity', 'Kenobi']);

  d = planReducer(d, { type: 'removeTask', step: s.key, task: added.key });
  d = planReducer(d, { type: 'removeTask', step: s.key, task: d.steps[1].tasks[0].key });
  assert.equal(d.steps[1].tasks.length, 1);
});

test('add and remove steps within limits', () => {
  let d = fromAnalysis(analysis);
  for (let i = 0; i < 20; i++) d = planReducer(d, { type: 'addStep' });
  assert.equal(d.steps.length, MAX_STEPS);
  for (const s of [...d.steps]) d = planReducer(d, { type: 'removeStep', step: s.key });
  assert.equal(d.steps.length, 1);

  const k = d.steps[0].key;
  for (let i = 0; i < 20; i++) d = planReducer(d, { type: 'addTask', step: k });
  assert.equal(d.steps[0].tasks.length, MAX_TASKS);
});

test('toRequest drops blank tasks and empty steps, squeezes spaces', () => {
  let d = fromAnalysis(analysis);
  d = planReducer(d, { type: 'addStep' });             // new empty step
  d = planReducer(d, { type: 'addTask', step: d.steps[0].key });   // blank task
  d = planReducer(d, { type: 'title', value: '  Pentester   junior ' });
  const p = toRequest(d).proposal;
  assert.equal(p.title, 'Pentester junior');
  assert.equal(p.steps.length, 2);
  assert.deepEqual(p.steps[0].tasks, ['Pre Security', 'Bandit 0-10']);
});

test('draftErrors: missing title, nothing left, tasks without a step title', () => {
  let d = fromAnalysis(analysis);
  assert.match(draftErrors(planReducer(d, { type: 'title', value: '  ' }))[0], /titre/);

  d = planReducer(d, { type: 'stepTitle', step: d.steps[0].key, value: '' });
  assert.ok(draftErrors(d).some((e) => /pas de titre/.test(e)));

  d = planReducer(d, { type: 'stepTitle', step: d.steps[1].key, value: '' });
  assert.ok(draftErrors(d).some((e) => /au moins une étape/.test(e)));
});

test('preview: tier, XP and gains at the current category Elo', () => {
  const d = fromAnalysis(analysis);
  assert.deepEqual(preview(d, cats), {
    tier: { id: 'elite', label: 'Élite' }, xpPerTask: 50, categoryElo: 1000, stepGain: 105, bossGain: 210,
  });
  const it = planReducer(planReducer(d, { type: 'category', value: 'langues' }), { type: 'difficulty', value: 1900 });
  assert.equal(preview(it, cats).stepGain, 112);       // brief example: italien vs Elo 980
});
