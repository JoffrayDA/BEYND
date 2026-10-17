import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localDay, parseDayStartHour } from './game.js';

const at = (d, h, m = 0) => new Date(2026, 9, d, h, m); // local time, Oct 2026

test('localDay: the game day starts at 4 h by default', () => {
  assert.equal(localDay(at(17, 1)), '2026-10-16');    // 1 h → still yesterday
  assert.equal(localDay(at(17, 3, 59)), '2026-10-16');
  assert.equal(localDay(at(17, 4)), '2026-10-17');
  assert.equal(localDay(at(17, 23, 59)), '2026-10-17');
});

test('localDay: start hour is configurable, 0 = midnight', () => {
  assert.equal(localDay(at(17, 1), 0), '2026-10-17');
  assert.equal(localDay(at(17, 5), 6), '2026-10-16');
});

test('localDay: crosses month and DST boundaries', () => {
  assert.equal(localDay(new Date(2026, 9, 1, 2)), '2026-09-30');
  assert.equal(localDay(new Date(2026, 9, 25, 2, 30)), '2026-10-24'); // EU DST ends that night
});

test('parseDayStartHour: valid hours, else falls back to 4', () => {
  assert.equal(parseDayStartHour(undefined), 4);
  assert.equal(parseDayStartHour(''), 4);
  assert.equal(parseDayStartHour('0'), 0);
  assert.equal(parseDayStartHour('23'), 23);
  for (const bad of ['24', '-1', '4.5', 'abc']) assert.equal(parseDayStartHour(bad), 4, bad);
});

test('grantDemoXp: lands 5 XP short of the next level, Elo untouched; next tick levels up', async () => {
  const { openDb } = await import('./db.js');
  const { createGoal, grantDemoXp, homeState, toggleTask } = await import('./game.js');
  const db = openDb(':memory:');
  const now = at(17, 9);
  assert.throws(() => grantDemoXp(db, undefined, { now }), /create a goal first/);

  const goal = createGoal(db, { title: 'Ranger', category: 'autre', difficulty: 450, intro: '', steps: [{ title: 'Tri', tasks: ['a', 'b'] }] }, { now });
  const r = grantDemoXp(db, undefined, { now });
  assert.equal(r.granted, 995);
  assert.deepEqual([r.user.level, r.user.xpInLevel], [1, 995]);
  assert.equal(homeState(db, now).categories.find((c) => c.id === 'autre').elo, 1000);

  toggleTask(db, goal.steps[0].tasks[0].id, { now });
  assert.equal(homeState(db, now).user.level, 2);
  // Unticking cancels the tick only, never the demo XP.
  toggleTask(db, goal.steps[0].tasks[0].id, { now });
  assert.equal(homeState(db, now).user.xp, 995);

  assert.equal(grantDemoXp(db, 1500, { now }).user.xp, 2495);
  assert.throws(() => grantDemoXp(db, -3, { now }), /positive integer/);
});
