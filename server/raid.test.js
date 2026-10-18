// Sunday raid: pure rules, then a whole week through the API (in-memory db,
// mock coach, pinned clock). 2026-10-12 is a Monday, 2026-10-18 a Sunday.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from './db.js';
import { createApp } from './app.js';
import { analyzeGoal } from './llm.js';
import { grantDemoXp } from './game.js';
import {
  raidHp, raidBonus, plannedXp, pickReward, pickSpecies, raidStatus, raidDamage,
  MONSTERS, ACCESSORIES, SLOTS, RAID_MIN_HP, RAID_MAX_HP,
} from './raid.js';

// --- pure rules ----------------------------------------------------------------

test('catalog: every monster drops existing accessories, every accessory has a slot', () => {
  for (const m of Object.values(MONSTERS)) for (const id of m.loot) assert.ok(ACCESSORIES[id], id);
  for (const a of Object.values(ACCESSORIES)) assert.ok(SLOTS.includes(a.slot));
});

test('raidHp: first raid from last week, else from the plan; then ±10 %; bounded, multiple of 5', () => {
  assert.equal(raidHp({ lastWeekXp: 400, planned: 1000 }), 300);
  assert.equal(raidHp({ lastWeekXp: 0, planned: 250 }), 190);         // 187.5 → 190
  assert.equal(raidHp({ lastWeekXp: 0, planned: 0 }), RAID_MIN_HP);
  assert.equal(raidHp({ lastWeekXp: 99999 }), RAID_MAX_HP);
  assert.equal(raidHp({ previous: { hp: 190, won: true }, lastWeekXp: 5000 }), 210);   // 209 → 210
  assert.equal(raidHp({ previous: { hp: 190, won: false } }), 170);   // 171 → 170
  assert.equal(raidHp({ previous: { hp: 50, won: false } }), RAID_MIN_HP);
});

test('plannedXp and raidBonus', () => {
  assert.equal(plannedXp({ habits: [{ xp: 20, per_week: 3 }], projects: [{ task_xp: 50 }] }), 60 + 250);
  assert.equal(raidBonus(190), 38);
});

test('pickReward: species loot first, then anything new, then the first loot again', () => {
  assert.equal(pickReward('tech'), 'casque');
  assert.equal(pickReward('tech', ['casque']), 'baton');
  assert.equal(pickReward('tech', ['casque', 'baton', 'bouclier']), 'couronne');
  assert.equal(pickReward('tech', Object.keys(ACCESSORIES)), 'casque');
});

test('pickSpecies: main goal, else the most frequent category, else the slime', () => {
  assert.equal(pickSpecies({ mainCategory: 'sport', activeCategories: ['tech', 'tech'] }), 'sport');
  assert.equal(pickSpecies({ activeCategories: ['langues', 'tech', 'tech'] }), 'tech');
  assert.equal(pickSpecies({}), 'autre');
});

test('raidStatus and raidDamage over the week', () => {
  const week = '2026-10-12';
  assert.equal(raidStatus({ week, today: '2026-10-14' }), 'waiting');
  assert.equal(raidStatus({ week, today: '2026-10-18' }), 'ready');
  assert.equal(raidStatus({ week, today: '2026-10-18', assaultAt: 'x' }), 'fighting');
  assert.equal(raidStatus({ week, today: '2026-10-18', assaultAt: 'x', defeatedAt: 'y' }), 'won');
  assert.equal(raidStatus({ week, today: '2026-10-19', assaultAt: 'x' }), 'fled');
  assert.equal(raidDamage({ charge: 120 }), 0);
  assert.equal(raidDamage({ charge: 120, assaultAt: 'x' }), 120);
  assert.equal(raidDamage({ charge: -10, assaultAt: 'x' }), 0);
});

// --- through the API -------------------------------------------------------------

function setup() {
  const db = openDb(':memory:');
  let now = new Date(2026, 9, 14, 9, 0, 0);   // Wednesday
  const app = createApp({ db, analyze: ({ prompt }) => analyzeGoal({ prompt, client: null }), clock: () => now, hasKey: false, password: '' });
  const call = async (method, path, json) => {
    const res = await app.request(path, {
      method, headers: { 'content-type': 'application/json' },
      body: json === undefined ? undefined : JSON.stringify(json),
    });
    return { status: res.status, body: await res.json() };
  };
  return {
    db,
    get: (p) => call('GET', p),
    post: (p, j) => call('POST', p, j),
    at: (d, h = 9) => { now = new Date(2026, 9, d, h, 0, 0); },
    now: () => now,
  };
}

async function createPentester(api) {
  const a = await api.post('/api/goals/analyze', { prompt: 'Devenir pentester (eJPT)' });
  assert.equal((await api.post('/api/goals', a.body)).status, 201);
}

// Ticks the next quest task; returns the toggle response.
async function tickNext(api) {
  const { body: state } = await api.get('/api/state');
  const q = state.quest.find((x) => x.type === 'task' && !x.done);
  assert.ok(q, 'a task left to tick');
  const r = await api.post(`/api/tasks/${q.task_id}/toggle`);
  assert.equal(r.status, 200);
  return { ...r.body, task_id: q.task_id };
}

test('no active goal, no raid', async () => {
  const api = setup();
  assert.equal((await api.get('/api/state')).body.raid, null);
  assert.equal((await api.post('/api/raid/assault')).status, 409);
});

test('a whole raid week: charge, Sunday assault, live hits, win, untick takes it back', async () => {
  const api = setup();
  await createPentester(api);

  // Wednesday: the Golem of the week (tech main goal) cannot be hit yet.
  let raid = (await api.get('/api/state')).body.raid;
  assert.equal(raid.species, 'tech');
  assert.equal(raid.name, MONSTERS.tech.name);
  assert.equal(raid.status, 'waiting');
  assert.equal(raid.charge, 0);
  assert.equal(raid.assault_day, '2026-10-18');
  assert.equal(raid.reward.id, 'casque');
  assert.equal(raid.bonus_xp, raidBonus(raid.hp));
  const hp = raid.hp;
  assert.ok(hp >= RAID_MIN_HP);
  assert.equal((await api.post('/api/raid/assault')).status, 409);

  // Ticks charge the weapon (net XP); dev XP does not.
  const t1 = await tickNext(api);
  raid = t1.state.raid;
  const firstXp = t1.events.reduce((a, e) => a + e.delta_xp, 0);
  assert.equal(raid.charge, firstXp);
  assert.equal(raid.damage, 0);
  assert.equal(raid.hp_left, hp);
  grantDemoXp(api.db, 500, { now: api.now() });
  assert.equal((await api.get('/api/state')).body.raid.charge, firstXp);
  assert.equal((await api.get('/api/state')).body.raid.hp, hp, 'frozen once created');

  // Sunday: assault deals the whole charge at once, only once.
  api.at(18);
  assert.equal((await api.get('/api/state')).body.raid.status, 'ready');
  const a = await api.post('/api/raid/assault');
  assert.equal(a.status, 200);
  assert.deepEqual(a.body.events, []);
  assert.equal(a.body.raid.status, 'fighting');
  assert.equal(a.body.raid.damage, firstXp);
  assert.equal(a.body.raid.hp_left, hp - firstXp);
  assert.equal((await api.post('/api/raid/assault')).status, 409);

  // Sunday ticks keep hitting until the monster falls.
  let r;
  let guard = 0;
  do { r = await tickNext(api); guard += 1; } while (r.state.raid.status === 'fighting' && guard < 30);
  assert.equal(r.state.raid.status, 'won');
  const win = r.events.find((e) => e.kind === 'raid');
  assert.equal(win.delta_xp, raid.bonus_xp);
  assert.equal(win.delta_elo, 0);
  assert.equal(win.reward.id, 'casque');
  assert.equal(r.state.raid.hp_left, 0);

  // The bonus counts in the XP total, never in Elo.
  const before = r.state;
  const eloSum = api.db.prepare(`SELECT SUM(delta_elo) AS s FROM progress_events`).get().s;
  assert.ok(Math.abs(before.categories.find((c) => c.id === 'tech').elo - (1000 + eloSum)) < 0.01);
  const ledgerXp = api.db.prepare(`SELECT SUM(delta_xp) AS s FROM progress_events`).get().s;
  assert.equal(before.user.xp, ledgerXp + raid.bonus_xp);

  // Equip the reward; wrong slot 400, not owned 409, unknown slot 400.
  const g = await api.post('/api/gear', { slot: 'head', item: 'casque' });
  assert.equal(g.status, 200);
  assert.deepEqual(g.body.state.user.gear, { head: 'casque' });
  assert.equal((await api.post('/api/gear', { slot: 'hand', item: 'casque' })).status, 400);
  assert.equal((await api.post('/api/gear', { slot: 'head', item: 'couronne' })).status, 409);
  assert.equal((await api.post('/api/gear', { slot: 'cou', item: null })).status, 400);

  // Untick the last task: under the HP again → win and accessory taken back.
  const u = await api.post(`/api/tasks/${r.task_id}/toggle`);
  const lost = u.body.events.find((e) => e.kind === 'raid');
  assert.equal(lost.delta_xp, -raid.bonus_xp);
  assert.equal(u.body.state.raid.status, 'fighting');
  assert.deepEqual(u.body.state.user.gear, {});
  assert.equal(u.body.state.user.xp, before.user.xp - raid.bonus_xp - r.events.filter((e) => e.kind !== 'raid').reduce((x, e) => x + e.delta_xp, 0));

  // Tick it again: won again. Trophy listed.
  const again = await api.post(`/api/tasks/${r.task_id}/toggle`);
  assert.equal(again.body.state.raid.status, 'won');
  const col = (await api.get('/api/raids')).body;
  assert.equal(col.trophies.length, 1);
  assert.equal(col.trophies[0].name, MONSTERS.tech.name);
  assert.deepEqual(col.owned, ['casque']);
  assert.equal(col.fled, 0);

  // Next Monday: a stronger monster (+10 %), a new reward, the win is kept.
  api.at(19);
  raid = (await api.get('/api/state')).body.raid;
  assert.equal(raid.week, '2026-10-19');
  assert.equal(raid.hp, raidHp({ previous: { hp, won: true } }));
  assert.equal(raid.reward.id, 'baton');
  assert.equal(raid.status, 'waiting');
  assert.equal(raid.charge, 0);
});

test('a week without a win: the monster flees, the next one is weaker', async () => {
  const api = setup();
  await createPentester(api);
  const hp = (await api.get('/api/state')).body.raid.hp;
  api.at(18);
  assert.equal((await api.post('/api/raid/assault')).body.raid.status, 'fighting');
  api.at(19, 3);   // Monday 3 h is still Sunday's game day
  assert.equal((await api.get('/api/state')).body.raid.status, 'fighting');
  api.at(19, 5);
  const next = (await api.get('/api/state')).body.raid;
  assert.equal(next.hp, raidHp({ previous: { hp, won: false } }));
  assert.equal(next.reward.id, 'casque');
  assert.equal((await api.get('/api/raids')).body.fled, 1);
  assert.deepEqual((await api.get('/api/raids')).body.trophies, []);
});

test('progress history lists the raid won and its bonus XP', async () => {
  const api = setup();
  await createPentester(api);
  api.at(18);
  await api.post('/api/raid/assault');
  let r;
  let guard = 0;
  do { r = await tickNext(api); guard += 1; } while (r.state.raid.status === 'fighting' && guard < 30);
  const day = (await api.get('/api/progress')).body.history.find((d) => d.date === '2026-10-18');
  assert.ok(day.tasks.some((t) => t.label === `Raid : ${MONSTERS.tech.name} vaincu`));
});
