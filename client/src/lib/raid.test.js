import { test } from 'node:test';
import assert from 'node:assert/strict';
import { raidCard, gearSlots } from './raid.js';
import { celebrationFor } from './home.js';

const raid = (o = {}) => ({
  status: 'waiting', hp: 200, hp_left: 200, charge: 50, damage: 0,
  assault_day: '2026-10-18', reward: { id: 'casque', name: 'Casque de fer', slot: 'head' }, ...o,
});

test('raidCard: waiting counts the days to Sunday and shows the charge', () => {
  const c = raidCard(raid(), '2026-10-14');
  assert.equal(c.label, 'Combat dans 4 jours');
  assert.equal(c.chargePct, 25);
  assert.equal(c.hpPct, 100);
  assert.equal(c.canAssault, false);
  assert.equal(c.showCharge, true);
  assert.equal(raidCard(raid(), '2026-10-17').label, 'Combat demain');
});

test('raidCard: Sunday says whether the charge is enough', () => {
  const short = raidCard(raid({ status: 'ready' }), '2026-10-18');
  assert.equal(short.canAssault, true);
  assert.match(short.line, /fera 50 dégâts\. Il lui restera 150 PV/);
  assert.match(raidCard(raid({ status: 'ready', charge: 260 }), '2026-10-18').line, /d’un coup/);
  assert.equal(raidCard(raid({ status: 'ready', charge: 260 }), '2026-10-18').chargePct, 100);
});

test('raidCard: fighting, won, fled', () => {
  const f = raidCard(raid({ status: 'fighting', hp_left: 30, damage: 170 }), '2026-10-18');
  assert.equal(f.hpPct, 15);
  assert.equal(f.showCharge, false);
  assert.match(f.line, /reste 30 PV/);
  assert.match(raidCard(raid({ status: 'won', hp_left: 0 }), '2026-10-18').line, /casque de fer/);
  assert.equal(raidCard(raid({ status: 'fled' }), '2026-10-19').label, 'Enfui');
});

test('gearSlots: owned accessories by slot, empty slots left out', () => {
  assert.deepEqual(gearSlots(['epee', 'casque', 'couronne'], { head: 'couronne' }), [
    { slot: 'head', label: 'Tête', equipped: 'couronne', items: [{ id: 'casque', name: 'Casque de fer' }, { id: 'couronne', name: 'Couronne' }] },
    { slot: 'hand', label: 'Main', equipped: null, items: [{ id: 'epee', name: 'Épée' }] },
  ]);
  assert.deepEqual(gearSlots(), []);
});

test('celebrationFor: a raid won beats everything; losing it back is a toast', () => {
  const user = { level: 2 };
  const won = celebrationFor({
    events: [
      { kind: 'task', delta_xp: 50, delta_elo: 3 },
      { kind: 'step_bonus', delta_xp: 0, delta_elo: 40 },
      { kind: 'raid', delta_xp: 38, delta_elo: 0, name: 'Golem de code', reward: { id: 'casque', name: 'Casque de fer' } },
    ],
    before: user, after: user, goalTitle: 'G', stepTitle: 'S',
  });
  assert.equal(won.kind, 'raid');
  assert.equal(won.title, 'Raid gagné');
  assert.equal(won.subtitle, 'Golem de code');
  assert.equal(won.xp, 88);
  assert.equal(won.reward.name, 'Casque de fer');
  const lost = celebrationFor({
    events: [{ kind: 'task', delta_xp: -50, delta_elo: -3 }, { kind: 'raid', delta_xp: -38, delta_elo: 0 }],
    before: user, after: user,
  });
  assert.equal(lost.kind, 'toast');
  assert.equal(lost.xp, -88);
});
