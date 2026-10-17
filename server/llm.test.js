import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeGoal, validatePlan, CoachError, MAX_STEPS, MAX_TASKS } from './llm.js';

const valid = {
  title: 'Devenir pentester',
  category: 'tech',
  difficulty: 1850,
  intro: 'Six mois, une heure par jour.',
  steps: [{ title: 'Pre Security', tasks: ['Room How the Web Works', 'Room Linux Fundamentals 1'] }],
};

// Stand-in for the Gemini SDK: returns the queued responses in order.
function fakeClient(...responses) {
  const calls = [];
  return {
    calls,
    models: {
      generateContent: async (req) => {
        calls.push(req);
        const r = responses.shift();
        if (r instanceof Error) throw r;
        return r;
      },
    },
  };
}
const asCall = (args) => ({ functionCalls: [{ name: 'proposer_plan', args }] });

test('validatePlan keeps a well-formed plan as is', () => {
  assert.deepEqual(validatePlan(valid), valid);
});

test('validatePlan: category accepted by id or name, accents optional, else autre', () => {
  assert.equal(validatePlan({ ...valid, category: 'Carrière' }).category, 'carriere');
  assert.equal(validatePlan({ ...valid, category: 'CREATIF' }).category, 'creatif');
  assert.equal(validatePlan({ ...valid, category: 'Cuisine' }).category, 'autre');
  assert.equal(validatePlan({ ...valid, category: undefined }).category, 'autre');
});

test('validatePlan: difficulty clamped to 400–2200, must be numeric', () => {
  assert.equal(validatePlan({ ...valid, difficulty: 50 }).difficulty, 400);
  assert.equal(validatePlan({ ...valid, difficulty: '3000' }).difficulty, 2200);
  assert.throws(() => validatePlan({ ...valid, difficulty: 'dur' }), CoachError);
});

test('validatePlan: trims, drops empty tasks and steps, truncates overflow', () => {
  const plan = validatePlan({
    ...valid,
    title: '  Devenir   pentester ',
    steps: [
      { title: ' Étape vide ', tasks: ['', '   '] },
      { title: '', tasks: ['orpheline'] },
      ...Array.from({ length: 10 }, (_, i) => ({
        title: `Étape ${i}`,
        tasks: Array.from({ length: 12 }, (_, j) => ` tâche ${j} `),
      })),
    ],
  });
  assert.equal(plan.title, 'Devenir pentester');
  assert.equal(plan.steps.length, MAX_STEPS);
  assert.equal(plan.steps[0].title, 'Étape 0');
  assert.equal(plan.steps[0].tasks.length, MAX_TASKS);
  assert.equal(plan.steps[0].tasks[0], 'tâche 0');
});

test('validatePlan: rejects a plan without any usable step', () => {
  assert.throws(() => validatePlan({ ...valid, steps: [] }), CoachError);
  assert.throws(() => validatePlan({ ...valid, steps: [{ title: 'x', tasks: [] }] }), CoachError);
  assert.throws(() => validatePlan(null), CoachError);
});

test('validatePlan: falls back to the typed goal when the title is missing', () => {
  assert.equal(validatePlan({ ...valid, title: '' }, 'Parler italien').title, 'Parler italien');
});

test('analyzeGoal: mock mode without key returns the pentester plan', async () => {
  const plan = await analyzeGoal({ prompt: 'Devenir pentester (eJPT)', client: null });
  assert.equal(plan.title, 'Devenir pentester (eJPT)');
  assert.equal(plan.category, 'tech');
  assert.equal(plan.difficulty, 1850);
  assert.equal(plan.steps.length, 5);
  assert.match(plan.intro, /mock/);
});

test('analyzeGoal: rejects an empty goal without calling the model', async () => {
  const client = fakeClient();
  await assert.rejects(analyzeGoal({ prompt: '   ', client }), CoachError);
  assert.equal(client.calls.length, 0);
});

test('analyzeGoal: forces the proposer_plan function and sends the goal', async () => {
  const client = fakeClient(asCall(valid));
  const plan = await analyzeGoal({ prompt: 'Devenir pentester', client });
  assert.equal(plan.difficulty, 1850);
  const req = client.calls[0];
  assert.equal(req.config.toolConfig.functionCallingConfig.mode, 'ANY');
  assert.deepEqual(req.config.toolConfig.functionCallingConfig.allowedFunctionNames, ['proposer_plan']);
  assert.equal(req.config.thinkingConfig.thinkingBudget, 0);
  assert.match(req.contents[0].parts[0].text, /Devenir pentester/);
});

test('analyzeGoal: retries once after an unusable answer', async () => {
  const client = fakeClient({ functionCalls: [] }, asCall(valid));
  const plan = await analyzeGoal({ prompt: 'x', client });
  assert.equal(plan.title, 'Devenir pentester');
  assert.equal(client.calls.length, 2);
});

test('analyzeGoal: retries once after an API error', async () => {
  const client = fakeClient(new Error('503 overloaded'), asCall(valid));
  await analyzeGoal({ prompt: 'x', client });
  assert.equal(client.calls.length, 2);
});

test('analyzeGoal: gives up with CoachError after two failures', async () => {
  const client = fakeClient(asCall({ ...valid, steps: [] }), new Error('503 overloaded'));
  await assert.rejects(analyzeGoal({ prompt: 'x', client }), CoachError);
  assert.equal(client.calls.length, 2);
});
