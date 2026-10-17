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
