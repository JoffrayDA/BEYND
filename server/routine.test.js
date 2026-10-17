// Routines end to end through the API: in-memory db, pinned clock, no coach.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from './db.js';
import { createApp } from './app.js';
import { analyzeGoal } from './llm.js';

function setup() {
  const db = openDb(':memory:');
  let now = new Date(2026, 9, 12, 9, 0, 0); // Monday 12 Oct 2026, local time
  const app = createApp({ db, analyze: ({ prompt }) => analyzeGoal({ prompt, client: null }), clock: () => now, hasKey: false });
  const call = async (method, path, json) => {
    const res = await app.request(path, {
      method,
      headers: { 'content-type': 'application/json' },
      body: json === undefined ? undefined : JSON.stringify(json),
    });
    return { status: res.status, body: await res.json() };
  };
  return {
    get: (p) => call('GET', p),
    post: (p, j) => call('POST', p, j),
    patch: (p, j) => call('PATCH', p, j),
    setDay: (d) => { now = new Date(2026, 9, d, 9, 0, 0); },
  };
}

const plan = (over = {}) => ({
  prompt: 'Callisthénie',
  proposal: {
    kind: 'routine', title: 'Callisthénie', category: 'sport', difficulty: 1600, intro: '',
    habits: [{ label: 'Séance', per_week: 2 }, { label: 'Mobilité', per_week: 1 }],
    milestones: ['10 tractions', 'Muscle-up'], boss_weeks: 4,
    ...over,
  },
});
const reading = (over = {}) => plan({ title: 'Lecture', difficulty: 900, habits: [{ label: 'Lire 20 min', per_week: 1 }], ...over });

async function create(api, p = plan()) {
  const r = await api.post('/api/goals', p);
  assert.equal(r.status, 201);
  return r.body.goal;
}
const kinds = (r) => r.body.events.map((e) => e.kind);
const sportElo = (state) => state.categories.find((c) => c.id === 'sport').elo;
const toggle = (api, h) => api.post(`/api/habits/${h.id}/toggle`);

test('created with habits, milestones and boss; the quest lists its habits', async () => {
  const api = setup();
  const g = await create(api);
  assert.equal(g.kind, 'routine');
  assert.deepEqual(g.routine.habits.map((h) => [h.label, h.per_week, h.xp]), [['Séance', 2, 35], ['Mobilité', 1, 35]]);
  assert.deepEqual(g.steps.map((s) => [s.title, s.tasks.length]), [['10 tractions', 0], ['Muscle-up', 0]]);
  assert.equal(g.routine.boss_weeks, 4);
  assert.equal(g.routine.session_gain, 26.7);          // gain 80 / W 3
  const q = (await api.get('/api/state')).body.quest;
  assert.deepEqual(q.map((i) => [i.type, i.key, i.label, i.elo_gain]),
    [['habit', `h${g.routine.habits[0].id}`, 'Séance', 26.7], ['habit', `h${g.routine.habits[1].id}`, 'Mobilité', 26.7]]);
});

test('sessions, week bonus once the week holds, untick cancels exactly', async () => {
  const api = setup();
  const g = await create(api);
  const [seance, mob] = g.routine.habits;

  let r = await toggle(api, seance);
  assert.deepEqual(kinds(r), ['session']);
  r = await toggle(api, seance);                         // same day again = untick
  assert.equal(r.body.done, false);
  assert.equal(sportElo(r.body.state), 1000);

  await toggle(api, seance);
  api.setDay(13);
  await toggle(api, mob);
  api.setDay(14);
  r = await toggle(api, seance);                          // 2/2 + 1/1 → held
  assert.deepEqual(kinds(r), ['session', 'week_bonus']);
  const held = (await api.get(`/api/goals/${g.id}`)).body.goal.routine;
  assert.deepEqual([held.week.held, held.week.done, held.week.target, held.weeks_streak], [true, 3, 3, 1]);
  // Held week: habits leave the quest, except today's session.
  assert.deepEqual((await api.get('/api/state')).body.quest.map((i) => [i.label, i.done]), [['Séance', true]]);

  const before = sportElo(r.body.state);
  r = await toggle(api, seance);                          // untick → no longer held
  assert.deepEqual(kinds(r), ['week_bonus', 'session']);
  const undone = r.body.events.reduce((a, e) => a + e.delta_elo, 0);
  assert.equal(Math.round((sportElo(r.body.state) - before - undone) * 10), 0);
  assert.equal((await api.get(`/api/goals/${g.id}`)).body.goal.routine.week.held, false);
});

test('extra sessions pay half; streak and history include sessions', async () => {
  const api = setup();
  const g = await create(api, reading());
  const [h] = g.routine.habits;
  assert.deepEqual(kinds(await toggle(api, h)), ['session', 'week_bonus']);
  api.setDay(13);
  const extra = await toggle(api, h);
  assert.deepEqual(kinds(extra), ['session']);
  assert.equal(extra.body.events[0].delta_xp, 10);       // 900 = Moyen, 20 XP → half
  assert.equal((await api.get('/api/state')).body.user.streak, 2);
  const p = (await api.get('/api/progress')).body;
  assert.deepEqual(p.history.map((d) => [d.date, d.tasks.map((t) => t.label)]),
    [['2026-10-13', ['Lire 20 min']], ['2026-10-12', ['Lire 20 min']]]);
});

test('boss after boss_weeks held weeks in a row, only once', async () => {
  const api = setup();
  const g = await create(api, reading());
  const [h] = g.routine.habits;
  let r;
  for (const d of [5, 12, 19, 26]) { api.setDay(d); r = await toggle(api, h); }
  assert.deepEqual(kinds(r), ['session', 'week_bonus', 'boss']);
  const goal = (await api.get(`/api/goals/${g.id}`)).body.goal;
  assert.equal(goal.status, 'active');                   // a routine goes on
  assert.deepEqual([goal.routine.boss_done, goal.routine.weeks_streak, goal.progress.pct], [true, 4, 100]);
  assert.ok(goal.completed_at);

  api.setDay(27);
  assert.deepEqual(kinds(await toggle(api, h)), ['session']);      // boss only once
  api.setDay(26);
  assert.deepEqual(kinds(await toggle(api, h)), ['session']);      // the 27th still holds the week
  api.setDay(27);
  assert.deepEqual(kinds(await toggle(api, h)), ['boss', 'week_bonus', 'session']);
  const after = (await api.get(`/api/goals/${g.id}`)).body.goal;
  assert.deepEqual([after.routine.boss_done, after.completed_at], [false, null]);
});

test('milestones tick and untick; routes are guarded', async () => {
  const api = setup();
  const g = await create(api);
  const m = g.steps[1];
  let r = await api.post(`/api/milestones/${m.id}/toggle`);
  assert.deepEqual(r.body.events.map((e) => [e.kind, e.delta_elo, e.delta_xp]), [['milestone', 80, 175]]);
  r = await api.post(`/api/milestones/${m.id}/toggle`);
  assert.deepEqual(r.body.events.map((e) => [e.kind, e.delta_elo, e.delta_xp]), [['milestone', -80, -175]]);

  const a = await api.post('/api/goals/analyze', { prompt: 'Devenir pentester' });
  const project = (await api.post('/api/goals', a.body)).body.goal;
  assert.equal(project.kind, 'project');
  assert.equal((await api.post(`/api/milestones/${project.steps[0].id}/toggle`)).status, 409);
  assert.equal((await api.post(`/api/goals/${project.id}/level-up`, { mode: 'snooze' })).status, 409);
  assert.equal((await api.post('/api/habits/999/toggle')).status, 404);

  await api.patch(`/api/goals/${g.id}`, { status: 'archived' });
  assert.equal((await toggle(api, g.routine.habits[0])).status, 409);
  assert.equal((await api.patch(`/api/goals/${g.id}`, { status: 'active' })).body.goal.status, 'active');
});

test('level up: offered once Elo passes difficulty; frequency, harder, snooze', async () => {
  const api = setup();
  const g = await create(api, reading({ difficulty: 1000, habits: [{ label: 'Lire 20 min', per_week: 5 }] }));
  assert.deepEqual((await api.get('/api/state')).body.level_ups, []);
  await api.post(`/api/milestones/${g.steps[0].id}/toggle`);      // +20 → 1020 > 1000
  const offer = (await api.get('/api/state')).body.level_ups;
  assert.deepEqual(offer.map((l) => [l.goal_id, l.difficulty, l.new_difficulty]), [[g.id, 1000, 1150]]);
  assert.equal((await api.get(`/api/goals/${g.id}`)).body.goal.can_level_up, true);

  const h = g.routine.habits[0];
  let r = await api.post(`/api/goals/${g.id}/level-up`, { mode: 'frequency', habit_id: h.id });
  assert.equal(r.status, 200);
  assert.deepEqual([r.body.goal.difficulty, r.body.goal.routine.habits[0].per_week], [1150, 6]);
  assert.deepEqual(r.body.state.level_ups, []);                  // 1020 < 1150: no offer

  r = await api.post(`/api/goals/${g.id}/level-up`, { mode: 'harder', habit_id: h.id, label: '  Lire 30 min ' });
  assert.deepEqual([r.body.goal.routine.habits[0].label, r.body.goal.difficulty, r.body.goal.routine.habits[0].xp],
    ['Lire 30 min', 1300, 20]);
  assert.equal((await api.post(`/api/goals/${g.id}/level-up`, { mode: 'harder', habit_id: h.id, label: ' ' })).status, 409);
  assert.equal((await api.post(`/api/goals/${g.id}/level-up`, { mode: 'nope' })).status, 409);
  assert.equal((await api.post(`/api/goals/${g.id}/level-up`, { mode: 'frequency', habit_id: 999 })).status, 404);

  // Snooze hides the offer for 7 days.
  const g2 = await create(api, reading({ category: 'creatif', difficulty: 1000 }));
  await api.post(`/api/milestones/${g2.steps[0].id}/toggle`);
  const has = async () => (await api.get('/api/state')).body.level_ups.some((l) => l.goal_id === g2.id);
  assert.equal(await has(), true);
  await api.post(`/api/goals/${g2.id}/level-up`, { mode: 'snooze' });
  assert.equal(await has(), false);
  api.setDay(19);
  assert.equal(await has(), true);
});
