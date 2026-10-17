import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  gain, tier, taskXp, level, clampDifficulty, checkEvents, revertEvents,
  activeEvents, categoryElo, totalXp, lifeElo, streak, bestStreak, START_ELO,
} from './engine.js';

test('gain: brief examples', () => {
  assert.equal(gain(1900, 980), 112);  // italien, Elo Langues 980
  assert.equal(gain(450, 1050), 2);    // ranger son bureau, floored
  assert.equal(gain(1000, 1000), 20);  // at your level
});

test('tier and task XP boundaries', () => {
  assert.equal(tier(799).id, 'facile');
  assert.equal(tier(800).id, 'moyen');
  assert.equal(tier(1399).id, 'moyen');
  assert.equal(tier(1400).id, 'dur');
  assert.equal(tier(1799).id, 'dur');
  assert.equal(tier(1800).id, 'elite');
  assert.deepEqual([400, 1000, 1500, 2200].map(taskXp), [10, 20, 35, 50]);
});

test('clampDifficulty keeps 400–2200', () => {
  assert.equal(clampDifficulty(100), 400);
  assert.equal(clampDifficulty(9999), 2200);
  assert.equal(clampDifficulty(1849.6), 1850);
});

test('level: 1000 XP per level', () => {
  assert.deepEqual(level(0), { level: 1, xpInLevel: 0, xpForNext: 1000 });
  assert.equal(level(999).level, 1);
  assert.equal(level(1000).level, 2);
  assert.equal(level(2350).xpInLevel, 350);
});

test('checkEvents: task share of the step gain (pentester, 5 tasks)', () => {
  const ev = checkEvents({ difficulty: 1850, elo: 1000, taskCount: 5, xp: 50 });
  assert.deepEqual(ev, [{ kind: 'task', delta_xp: 50, delta_elo: 21, elo_after: 1021 }]);
});

test('checkEvents: small gains keep a decimal instead of rounding to 0', () => {
  const [e] = checkEvents({ difficulty: 450, elo: 1050, taskCount: 5, xp: 10 });
  assert.equal(e.delta_elo, 0.4);
});

test('checkEvents: step bonus uses the Elo reached after the task', () => {
  const ev = checkEvents({ difficulty: 1850, elo: 1080, taskCount: 5, xp: 50, stepCompleted: true });
  assert.equal(ev.length, 2);
  assert.deepEqual(ev[0], { kind: 'task', delta_xp: 50, delta_elo: 19.4, elo_after: 1099.4 });
  // gain(1850, 1099.4) = round(75.06 + 20) = 95
  assert.deepEqual(ev[1], { kind: 'step_bonus', delta_xp: 0, delta_elo: 95, elo_after: 1194.4 });
});

test('checkEvents: boss pays gain x2 after the step bonus', () => {
  const ev = checkEvents({ difficulty: 1850, elo: 1000, taskCount: 1, xp: 50, stepCompleted: true, goalCompleted: true });
  assert.deepEqual(ev.map((e) => e.kind), ['task', 'step_bonus', 'boss']);
  // task: 105 → 1105 ; bonus: gain(1850,1105)=95 → 1200 ; boss: gain(1850,1200)=85 ×2 → 1370
  assert.deepEqual(ev.map((e) => e.delta_elo), [105, 95, 170]);
  assert.equal(ev.at(-1).elo_after, 1370);
});

test('checkEvents: rejects inconsistent input', () => {
  assert.throws(() => checkEvents({ difficulty: 1000, elo: 1000, taskCount: 0, xp: 20 }));
  assert.throws(() => checkEvents({ difficulty: 1000, elo: 1000, taskCount: 2, xp: 20, goalCompleted: true }));
});

test('revertEvents: exact opposite, boss first, back to the original Elo', () => {
  const granted = checkEvents({ difficulty: 1850, elo: 1000, taskCount: 1, xp: 50, stepCompleted: true, goalCompleted: true })
    .map((e, i) => ({ ...e, id: i + 1 }));
  const rev = revertEvents({ elo: 1370, events: granted });
  assert.deepEqual(rev.map((e) => e.kind), ['boss', 'step_bonus', 'task']);
  assert.deepEqual(rev.map((e) => e.reverts_id), [3, 2, 1]);
  assert.deepEqual(rev.map((e) => e.delta_elo), [-170, -95, -105]);
  assert.equal(rev.at(-1).elo_after, START_ELO);
  assert.equal(totalXp([...granted, ...rev]), 0);
});

test('check / uncheck / recheck: recheck recomputes with the current Elo', () => {
  const cat = 'tech';
  let id = 0;
  const log = [];
  const store = (evs) => evs.forEach((e) => log.push({ ...e, id: ++id, category_id: cat }));

  store(checkEvents({ difficulty: 1850, elo: categoryElo(log, cat), taskCount: 5, xp: 50 }));
  const toRevert = activeEvents(log).filter((e) => e.kind === 'task');
  store(revertEvents({ elo: categoryElo(log, cat), events: toRevert }));
  assert.equal(categoryElo(log, cat), START_ELO);
  assert.equal(activeEvents(log).length, 0);

  store(checkEvents({ difficulty: 1850, elo: categoryElo(log, cat), taskCount: 5, xp: 50 }));
  assert.equal(categoryElo(log, cat), 1021);
  assert.equal(totalXp(log), 50);
});

test('categoryElo isolates categories (Bullet ≠ Blitz)', () => {
  const log = [
    { category_id: 'tech', delta_elo: 21, delta_xp: 50 },
    { category_id: 'langues', delta_elo: -3.5, delta_xp: 0 },
  ];
  assert.equal(categoryElo(log, 'tech'), 1021);
  assert.equal(categoryElo(log, 'langues'), 996.5);
  assert.equal(categoryElo(log, 'sport'), START_ELO);
});

test('lifeElo: mean of active categories, 1000 when none', () => {
  assert.equal(lifeElo([]), 1000);
  assert.equal(lifeElo([1021, 980]), 1000.5);
});

test('streak: consecutive days ending today or yesterday', () => {
  const today = '2026-10-16';
  assert.equal(streak([], today), 0);
  assert.equal(streak(['2026-10-16'], today), 1);
  assert.equal(streak(['2026-10-14', '2026-10-15', '2026-10-16', '2026-10-16'], today), 3);
  assert.equal(streak(['2026-10-14', '2026-10-15'], today), 2);      // not ticked yet today
  assert.equal(streak(['2026-10-13', '2026-10-14'], today), 0);      // a full day missed
  assert.equal(streak(['2026-10-10', '2026-10-15', '2026-10-16'], today), 2);
  assert.equal(streak(['2026-09-30', '2026-10-01'], '2026-10-01'), 2); // month boundary
});

test('bestStreak: longest run ever, duplicates and order ignored', () => {
  assert.equal(bestStreak([]), 0);
  assert.equal(bestStreak(['2026-10-16']), 1);
  assert.equal(bestStreak(['2026-10-12', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-02', '2026-10-11']), 3);
  assert.equal(bestStreak(['2026-09-30', '2026-10-01']), 2);
});
