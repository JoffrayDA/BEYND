import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withStart, activityWeeks, fmtDay, plural } from './progress.js';

test('withStart: anchors at 1000 the day before, across a month boundary', () => {
  assert.deepEqual(withStart([{ date: '2026-10-01', value: 1021 }]), [
    { date: '2026-09-30', value: 1000 }, { date: '2026-10-01', value: 1021 },
  ]);
  assert.deepEqual(withStart([]), []);
});

test('activityWeeks: Monday-first weeks ending with the current week', () => {
  // 2026-10-17 is a Saturday.
  const history = [
    { date: '2026-10-17', tasks: [{}] },
    { date: '2026-10-15', tasks: [] },          // everything unticked: not a played day
    { date: '2026-10-05', tasks: [{}] },
  ];
  const w = activityWeeks(history, '2026-10-17', 2);
  assert.equal(w.length, 2);
  assert.equal(w[0][0].date, '2026-10-05');      // Monday of the previous week
  assert.equal(w[0][0].on, true);
  assert.equal(w[1][5].date, '2026-10-17');
  assert.deepEqual([w[1][5].on, w[1][5].today, w[1][5].future], [true, true, false]);
  assert.equal(w[1][3].on, false);
  assert.equal(w[1][6].future, true);            // Sunday not played yet
});

test('fmtDay: today, yesterday, then short French date', () => {
  assert.equal(fmtDay('2026-10-17', '2026-10-17'), 'Aujourd’hui');
  assert.equal(fmtDay('2026-10-16', '2026-10-17'), 'Hier');
  assert.match(fmtDay('2026-10-14', '2026-10-17'), /^mer\. 14 oct\.$/);
});

test('plural', () => {
  assert.equal(plural(1, 'jour'), '1 jour');
  assert.equal(plural(3, 'jour'), '3 jours');
});
