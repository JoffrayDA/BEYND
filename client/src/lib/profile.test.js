import { test } from 'node:test';
import assert from 'node:assert/strict';
import { profileStats } from './profile.js';

const project = (status) => ({ status, routine: null });
const routine = (boss_done) => ({ status: 'active', routine: { boss_done } });

test('profileStats: counts goals, bosses (projects and routines), streak and days', () => {
  const s = profileStats({
    active: [project('active'), project('done'), routine(false), routine(true)],
    archived: [project('archived'), { status: 'archived', routine: { boss_done: true } }],
    progress: {
      streak: { current: 2, best: 5 },
      history: [{ tasks: [{}] }, { tasks: [] }, { tasks: [{}, {}] }],
    },
  });
  assert.deepEqual(s, { inProgress: 2, routines: 2, bosses: 3, bestStreak: 5, activeDays: 2 });
});

test('profileStats: empty while loading', () => {
  assert.deepEqual(profileStats({}), { inProgress: 0, routines: 0, bosses: 0, bestStreak: 0, activeDays: 0 });
});
