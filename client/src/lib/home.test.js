import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fmtElo, fmtGain, celebrationFor, avatarTier } from './home.js';

const lvl = (level) => ({ level });

test('fmtElo rounds to a whole number, French grouping', () => {
  assert.equal(fmtElo(1041.6), '1 042');
  assert.equal(fmtElo(999.4), '999');
});

test('fmtGain: sign, decimal comma under 10, whole above', () => {
  assert.equal(fmtGain(21.3), '+21');
  assert.equal(fmtGain(0.4), '+0,4');
  assert.equal(fmtGain(-20.6), '−21');
  assert.equal(fmtGain(-2), '−2');
  assert.equal(fmtGain(0), '±0');
});

test('celebration: plain tick and untick are toasts', () => {
  const c = celebrationFor({ events: [{ kind: 'task', delta_elo: 21, delta_xp: 50 }], before: lvl(1), after: lvl(1) });
  assert.deepEqual(c, { kind: 'toast', elo: 21, xp: 50 });
  const u = celebrationFor({
    events: [{ kind: 'step_bonus', delta_elo: -95, delta_xp: 0 }, { kind: 'task', delta_elo: -19.4, delta_xp: -50 }],
    before: lvl(1), after: lvl(1),
  });
  assert.equal(u.kind, 'toast');                 // reverting a bonus is not celebrated
  assert.equal(u.elo, -114.4);
});

test('celebration: step, boss, level-up priority', () => {
  const step = [{ kind: 'task', delta_elo: 19.4, delta_xp: 50 }, { kind: 'step_bonus', delta_elo: 95, delta_xp: 0 }];
  const s = celebrationFor({ events: step, before: lvl(1), after: lvl(1), stepTitle: 'Bases' });
  assert.equal(s.kind, 'step');
  assert.equal(s.bonus, 95);
  assert.equal(s.subtitle, 'Bases');

  const boss = [...step, { kind: 'boss', delta_elo: 170, delta_xp: 0 }];
  const b = celebrationFor({ events: boss, before: lvl(1), after: lvl(2), goalTitle: 'Pentester' });
  assert.equal(b.kind, 'boss');
  assert.equal(b.bonus, 265);                     // step bonus 95 + boss 170
  assert.equal(b.levelUp, 2);                     // shown inside the boss card

  const l = celebrationFor({ events: [{ kind: 'task', delta_elo: 2, delta_xp: 50 }], before: lvl(3), after: lvl(4) });
  assert.equal(l.kind, 'level');
  assert.equal(l.title, 'Niveau 4');
});

test('avatar tier by level', () => {
  assert.deepEqual([1, 4, 5, 9, 10, 19, 20].map(avatarTier), ['moyen', 'moyen', 'facile', 'facile', 'dur', 'dur', 'elite']);
});

test('celebrationFor: routine week held and milestone reached', () => {
  const week = celebrationFor({
    events: [{ kind: 'session', delta_elo: 26.7, delta_xp: 35 }, { kind: 'week_bonus', delta_elo: 77, delta_xp: 0 }],
    before: lvl(1), after: lvl(1), goalTitle: 'Callisthénie', stepTitle: null,
  });
  assert.deepEqual([week.kind, week.title, week.subtitle, week.bonus], ['step', 'Semaine tenue', 'Callisthénie', 77]);
  const m = celebrationFor({
    events: [{ kind: 'milestone', delta_elo: 80, delta_xp: 175 }], before: lvl(1), after: lvl(1),
    goalTitle: 'Callisthénie', stepTitle: 'Muscle-up',
  });
  assert.deepEqual([m.title, m.subtitle, m.xp], ['Jalon atteint', 'Muscle-up', 175]);
  const undo = celebrationFor({ events: [{ kind: 'milestone', delta_elo: -80, delta_xp: -175 }], before: lvl(1), after: lvl(1) });
  assert.equal(undo.kind, 'toast');
});
