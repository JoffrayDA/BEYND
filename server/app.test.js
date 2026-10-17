// End-to-end API tests: in-memory db, mock coach (never calls Gemini), pinned clock.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from './db.js';
import { createApp } from './app.js';
import { analyzeGoal, CoachError } from './llm.js';

const mockCoach = ({ prompt }) => analyzeGoal({ prompt, client: null });

function setup({ analyze = mockCoach } = {}) {
  const db = openDb(':memory:');
  let now = new Date(2026, 9, 17, 9, 0, 0); // local time, 17 Oct 2026
  const app = createApp({ db, analyze, clock: () => now, hasKey: false });
  const call = async (method, path, json) => {
    const res = await app.request(path, {
      method,
      headers: { 'content-type': 'application/json' },
      body: json === undefined ? undefined : JSON.stringify(json),
    });
    return { status: res.status, body: await res.json() };
  };
  return {
    db,
    get: (p) => call('GET', p),
    post: (p, j) => call('POST', p, j),
    patch: (p, j) => call('PATCH', p, j),
    setDay: (d, h = 9, m = 0) => { now = new Date(2026, 9, d, h, m, 0); },
  };
}

async function createPentester(api) {
  const a = await api.post('/api/goals/analyze', { prompt: 'Devenir pentester (eJPT)' });
  const r = await api.post('/api/goals', a.body);
  assert.equal(r.status, 201);
  return r.body.goal;
}

const tinyPlan = {
  prompt: 'Ranger mon bureau',
  proposal: { title: 'Ranger mon bureau', category: 'autre', difficulty: 450, intro: '', steps: [{ title: 'Tri', tasks: ['Vider le bureau'] }] },
};

test('fresh state: everything at its starting point', async () => {
  const api = setup();
  const { status, body } = await api.get('/api/state');
  assert.equal(status, 200);
  assert.equal(body.hasKey, false);
  assert.equal(body.today, '2026-10-17');
  assert.deepEqual(
    { xp: body.user.xp, level: body.user.level, streak: body.user.streak },
    { xp: 0, level: 1, streak: 0 },
  );
  assert.equal(body.life_elo.value, 1000);
  assert.equal(body.categories.length, 6);
  assert.ok(body.categories.every((c) => c.elo === 1000 && !c.active));
  assert.deepEqual(body.quest, []);
  assert.equal(body.main_goal, null);
});

test('analyze returns a proposal with preview, persists nothing', async () => {
  const api = setup();
  const { status, body } = await api.post('/api/goals/analyze', { prompt: 'Devenir pentester (eJPT)' });
  assert.equal(status, 200);
  assert.equal(body.proposal.category, 'tech');
  assert.equal(body.proposal.difficulty, 1850);
  assert.deepEqual(body.preview, { tier: { id: 'elite', label: 'Élite' }, xp_per_task: 50, category_elo: 1000, potential_gain: 105 });
  assert.equal(api.db.prepare(`SELECT COUNT(*) AS n FROM goals`).get().n, 0);
});

test('analyze: empty or too long prompt → 400, coach failure → 502', async () => {
  const api = setup({ analyze: async () => { throw new CoachError('down'); } });
  assert.equal((await api.post('/api/goals/analyze', { prompt: '  ' })).status, 400);
  assert.equal((await api.post('/api/goals/analyze', { prompt: 'x'.repeat(501) })).status, 400);
  const r = await api.post('/api/goals/analyze', { prompt: 'Devenir pentester' });
  assert.equal(r.status, 502);
  assert.equal(api.db.prepare(`SELECT COUNT(*) AS n FROM goals`).get().n, 0);
});

test('create: goal, steps, tasks with tier XP; first goal becomes main', async () => {
  const api = setup();
  const goal = await createPentester(api);
  assert.equal(goal.is_main, true);
  assert.equal(goal.status, 'active');
  assert.equal(goal.steps.length, 5);
  assert.ok(goal.steps.flatMap((s) => s.tasks).every((t) => t.xp === 50 && t.done_on === null));
  assert.equal(goal.progress.tasks_total, 21);  // mock plan: 5 + 4 + 4 + 5 + 3

  const second = (await api.post('/api/goals', tinyPlan)).body.goal;
  assert.equal(second.is_main, false);
});

test('create: an edited proposal is re-validated server-side', async () => {
  const api = setup();
  const bad = await api.post('/api/goals', { proposal: { ...tinyPlan.proposal, steps: [] } });
  assert.equal(bad.status, 400);
  const edited = await api.post('/api/goals', { proposal: { ...tinyPlan.proposal, category: 'Cuisine', difficulty: 9000 } });
  assert.equal(edited.status, 201);
  assert.equal(edited.body.goal.category_id, 'autre');
  assert.equal(edited.body.goal.difficulty, 2200);
});

test('quest: next 3 tasks of the current step, main goal first, with Elo gain', async () => {
  const api = setup();
  await api.post('/api/goals', tinyPlan);            // created first → main
  const pentester = await createPentester(api);
  const { quest } = (await api.get('/api/state')).body;
  assert.equal(quest.length, 1 + 3);
  assert.equal(quest[0].goal_title, 'Ranger mon bureau');
  const p = quest.slice(1);
  assert.ok(p.every((q) => q.goal_id === pentester.id && q.step_title === 'Mois 1 — Bases' && !q.done));
  assert.equal(p[0].elo_gain, 21);                    // 105 / 5
  assert.equal(p[0].xp, 50);
});

test('ticking a whole step: daily Elo, step bonus, XP, then untick reverts the bonus', async () => {
  const api = setup();
  const goal = await createPentester(api);
  const step = goal.steps[0];

  const elos = [];
  let last;
  for (const t of step.tasks) {
    last = await api.post(`/api/tasks/${t.id}/toggle`);
    assert.equal(last.status, 200);
    elos.push(last.body.events.at(-1).elo_after);
  }
  // 1000 → +21 → +20.6 → +20.2 → +19.8 → +19.4, then bonus gain(1850, 1101) = 95
  assert.deepEqual(elos, [1021, 1041.6, 1061.8, 1081.6, 1196]);
  assert.deepEqual(last.body.events.map((e) => e.kind), ['task', 'step_bonus']);
  assert.equal(last.body.state.user.xp, 250);
  assert.equal(last.body.state.categories.find((c) => c.id === 'tech').elo, 1196);
  assert.equal(last.body.state.life_elo.value, 1196);
  assert.equal(last.body.state.main_goal.current_step, 'Mois 2 — Cyber Security 101');

  // Untick the 2nd task: its own +20.6 and the step bonus go away.
  const un = await api.post(`/api/tasks/${step.tasks[1].id}/toggle`);
  assert.equal(un.body.done, false);
  assert.deepEqual(un.body.events.map((e) => [e.kind, e.delta_elo]), [['step_bonus', -95], ['task', -20.6]]);
  assert.equal(un.body.state.categories.find((c) => c.id === 'tech').elo, 1080.4);
  assert.equal(un.body.state.user.xp, 200);
  const detail = (await api.get(`/api/goals/${goal.id}`)).body.goal;
  assert.equal(detail.steps[0].status, 'todo');

  // Re-tick: completes the step again, gains recomputed at the current Elo.
  const re = await api.post(`/api/tasks/${step.tasks[1].id}/toggle`);
  assert.deepEqual(re.body.events.map((e) => e.kind), ['task', 'step_bonus']);
  assert.equal(re.body.state.user.xp, 250);
});

test('boss: last task of the last step pays task + step bonus + gain×2; untick reverts all', async () => {
  const api = setup();
  const goal = (await api.post('/api/goals', tinyPlan)).body.goal;
  const taskId = goal.steps[0].tasks[0].id;

  const r = await api.post(`/api/tasks/${taskId}/toggle`);
  assert.deepEqual(r.body.events.map((e) => [e.kind, e.delta_elo, e.elo_after]),
    [['task', 2, 1002], ['step_bonus', 2, 1004], ['boss', 4, 1008]]);
  assert.equal(r.body.state.user.xp, 10);
  let g = (await api.get(`/api/goals/${goal.id}`)).body.goal;
  assert.equal(g.status, 'done');
  assert.ok(g.completed_at);

  // A goal finished today stays in the quest so it can be unticked.
  assert.ok(r.body.state.quest.some((q) => q.task_id === taskId && q.done));

  const un = await api.post(`/api/tasks/${taskId}/toggle`);
  assert.deepEqual(un.body.events.map((e) => e.kind), ['boss', 'step_bonus', 'task']);
  assert.equal(un.body.state.categories.find((c) => c.id === 'autre').elo, 1000);
  g = (await api.get(`/api/goals/${goal.id}`)).body.goal;
  assert.equal(g.status, 'active');
  assert.equal(g.completed_at, null);
});

test('categories stay independent; life Elo averages active ones', async () => {
  const api = setup();
  const pentester = await createPentester(api);
  await api.post('/api/goals', tinyPlan);
  const r = await api.post(`/api/tasks/${pentester.steps[0].tasks[0].id}/toggle`);
  const cats = Object.fromEntries(r.body.state.categories.map((c) => [c.id, c.elo]));
  assert.equal(cats.tech, 1021);
  assert.equal(cats.autre, 1000);
  assert.equal(cats.langues, 1000);
  assert.equal(r.body.state.life_elo.value, 1010.5);  // (1021 + 1000) / 2
});

test('streak and progress history across days', async () => {
  const api = setup();
  const goal = await createPentester(api);
  const [t1, t2, t3] = goal.steps[0].tasks;
  api.setDay(15); await api.post(`/api/tasks/${t1.id}/toggle`);
  api.setDay(16); await api.post(`/api/tasks/${t2.id}/toggle`);
  api.setDay(17);
  assert.equal((await api.get('/api/state')).body.user.streak, 2);   // not ticked yet today
  await api.post(`/api/tasks/${t3.id}/toggle`);

  const p = (await api.get('/api/progress')).body;
  assert.equal(p.today, '2026-10-17');
  assert.deepEqual(p.streak, { current: 3, best: 3 });
  assert.deepEqual(p.history.map((d) => d.date), ['2026-10-17', '2026-10-16', '2026-10-15']);
  assert.equal(p.history[2].elo_delta, 21);
  assert.equal(p.history[2].tasks[0].label, t1.label);
  const tech = p.categories.find((c) => c.id === 'tech');
  assert.deepEqual(tech.series, [
    { date: '2026-10-15', elo: 1021 },
    { date: '2026-10-16', elo: 1041.6 },
    { date: '2026-10-17', elo: 1061.8 },
  ]);
});

test('goals list: category filter, archive, main reassignment', async () => {
  const api = setup();
  const pentester = await createPentester(api);
  const bureau = (await api.post('/api/goals', tinyPlan)).body.goal;

  assert.equal((await api.get('/api/goals')).body.goals.length, 2);
  const tech = (await api.get('/api/goals?category=tech')).body.goals;
  assert.deepEqual(tech.map((g) => g.id), [pentester.id]);
  assert.equal(tech[0].potential_gain, 105);
  assert.equal((await api.get('/api/goals?category=cuisine')).status, 400);

  // Switch main, then archive it: main falls back to the remaining goal.
  assert.equal((await api.patch(`/api/goals/${bureau.id}`, { is_main: true })).body.goal.is_main, true);
  assert.equal((await api.get(`/api/goals/${pentester.id}`)).body.goal.is_main, false);
  await api.patch(`/api/goals/${bureau.id}`, { status: 'archived' });
  assert.equal((await api.get('/api/state')).body.main_goal.id, pentester.id);
  assert.deepEqual((await api.get('/api/goals?archived=1')).body.goals.map((g) => g.id), [bureau.id]);
  assert.equal((await api.get('/api/state')).body.categories.find((c) => c.id === 'autre').active, false);

  // Archived goals can't be ticked; unarchiving restores them.
  const t = bureau.steps[0].tasks[0].id;
  assert.equal((await api.post(`/api/tasks/${t}/toggle`)).status, 409);
  assert.equal((await api.patch(`/api/goals/${bureau.id}`, { status: 'active' })).body.goal.status, 'active');
  assert.equal((await api.post(`/api/tasks/${t}/toggle`)).status, 200);
});

test('rename, invalid status and unknown ids', async () => {
  const api = setup();
  const g = await createPentester(api);
  assert.equal((await api.patch(`/api/goals/${g.id}`, { title: '  Pentester  junior ' })).body.goal.title, 'Pentester junior');
  assert.equal((await api.patch(`/api/goals/${g.id}`, { title: '  ' })).status, 409);
  assert.equal((await api.patch(`/api/goals/${g.id}`, { status: 'done' })).status, 409);
  assert.equal((await api.get('/api/goals/999')).status, 404);
  assert.equal((await api.get('/api/goals/abc')).status, 404);
  assert.equal((await api.post('/api/tasks/999/toggle')).status, 404);
});

test('a tick at 1 h counts for the previous day (day starts at 4 h)', async () => {
  const api = setup();
  const goal = await createPentester(api);
  const [t1, t2] = goal.steps[0].tasks;

  api.setDay(16, 21); await api.post(`/api/tasks/${t1.id}/toggle`);
  api.setDay(17, 1, 30);
  const late = await api.post(`/api/tasks/${t2.id}/toggle`);
  assert.equal(late.body.state.today, '2026-10-16');
  assert.ok(late.body.state.quest.some((q) => q.task_id === t2.id && q.done));
  const detail = (await api.get(`/api/goals/${goal.id}`)).body.goal;
  assert.equal(detail.steps[0].tasks[1].done_on, '2026-10-16');

  // Both ticks land on the 16th: one history day, streak of 1, not 2.
  const p = (await api.get('/api/progress')).body;
  assert.deepEqual(p.history.map((d) => d.date), ['2026-10-16']);
  assert.equal(p.history[0].tasks.length, 2);
  assert.deepEqual(p.streak, { current: 1, best: 1 });

  // From 4 h it is the 17th; the streak is still alive until ticked.
  api.setDay(17, 4);
  const s = (await api.get('/api/state')).body;
  assert.equal(s.today, '2026-10-17');
  assert.equal(s.user.streak, 1);
});

test('daily deltas: per category and for life Elo, reset on a new game day', async () => {
  const api = setup();
  const goal = await createPentester(api);
  await api.post('/api/goals', tinyPlan);
  const [t1, t2, t3] = goal.steps[0].tasks;

  api.setDay(16); await api.post(`/api/tasks/${t1.id}/toggle`);           // tech 1000 → 1021
  api.setDay(17);
  let s = (await api.get('/api/state')).body;
  assert.equal(s.categories.find((c) => c.id === 'tech').delta_today, 0);
  assert.equal(s.life_elo.delta_today, 0);

  await api.post(`/api/tasks/${t2.id}/toggle`);                           // +20.6
  s = (await api.post(`/api/tasks/${t3.id}/toggle`)).body.state;           // +20.2
  assert.equal(s.categories.find((c) => c.id === 'tech').delta_today, 40.8);
  assert.equal(s.categories.find((c) => c.id === 'autre').delta_today, 0);
  // Life Elo = mean(tech, autre): (1061.8 + 1000) / 2 = 1030.9, was (1021 + 1000) / 2 = 1010.5
  assert.equal(s.life_elo.value, 1030.9);
  assert.equal(s.life_elo.delta_today, 20.4);

  // Unticking today's task removes its share from today's delta.
  s = (await api.post(`/api/tasks/${t3.id}/toggle`)).body.state;
  assert.equal(s.categories.find((c) => c.id === 'tech').delta_today, 20.6);
});

test('quest: a ticked task shows what it earned, not the current potential', async () => {
  const api = setup();
  const goal = await createPentester(api);
  const [t1, t2] = goal.steps[0].tasks;
  await api.post(`/api/tasks/${t1.id}/toggle`);                 // +21 at Elo 1000
  const s = (await api.post(`/api/tasks/${t2.id}/toggle`)).body.state;   // +20.6
  const q = Object.fromEntries(s.quest.map((i) => [i.task_id, i]));
  assert.equal(q[t1.id].elo_gain, 21);
  assert.equal(q[t2.id].elo_gain, 20.6);
  assert.ok(s.quest.filter((i) => !i.done).every((i) => i.elo_gain === 20.2)); // next potential at 1041.6
});
