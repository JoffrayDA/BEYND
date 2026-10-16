import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDb, transaction, CATEGORIES } from './db.js';

const now = '2026-10-16T08:00:00.000Z';

function seedGoal(db, overrides = {}) {
  const g = { category_id: 'tech', title: 'Devenir pentester', difficulty: 1850, ...overrides };
  const goalId = db.prepare(
    `INSERT INTO goals (category_id, title, difficulty, created_at) VALUES (?, ?, ?, ?)`
  ).run(g.category_id, g.title, g.difficulty, now).lastInsertRowid;
  const stepId = db.prepare(`INSERT INTO steps (goal_id, title, ordre) VALUES (?, 'Pre Security', 0)`)
    .run(goalId).lastInsertRowid;
  const taskId = db.prepare(`INSERT INTO tasks (step_id, label, ordre, xp) VALUES (?, 'How the Web Works', 0, 50)`)
    .run(stepId).lastInsertRowid;
  return { goalId, stepId, taskId };
}

const insEvent = (db, e) => db.prepare(
  `INSERT INTO progress_events (category_id, goal_id, step_id, task_id, kind, delta_xp, delta_elo, elo_after, reverts_id, created_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
).run(e.category_id ?? 'tech', e.goal_id, e.step_id ?? null, e.task_id ?? null, e.kind ?? 'task',
  e.delta_xp ?? 0, e.delta_elo, e.elo_after, e.reverts_id ?? null, now);

test('fresh database: schema, categories and singleton user', () => {
  const db = openDb(':memory:');
  const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`)
    .all().map((r) => r.name);
  assert.deepEqual(tables, ['categories', 'goals', 'progress_events', 'steps', 'tasks', 'user']);
  assert.deepEqual(db.prepare(`SELECT id FROM categories ORDER BY ordre`).all().map((r) => r.id), CATEGORIES.map((c) => c.id));
  assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM user`).get().n, 1);
  for (const t of ['goals', 'steps', 'tasks', 'progress_events']) {
    assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n, 0, `${t} should start empty`);
  }
});

test('reopening a file database is idempotent and keeps data', () => {
  const dir = mkdtempSync(join(tmpdir(), 'elo-db-'));
  const file = join(dir, 'elo.db');
  try {
    const db1 = openDb(file);
    seedGoal(db1);
    db1.close();
    const db2 = openDb(file);
    assert.equal(db2.prepare(`SELECT COUNT(*) AS n FROM categories`).get().n, CATEGORIES.length);
    assert.equal(db2.prepare(`SELECT COUNT(*) AS n FROM user`).get().n, 1);
    assert.equal(db2.prepare(`SELECT COUNT(*) AS n FROM goals`).get().n, 1);
    db2.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('constraints: difficulty range, enums, unknown category', () => {
  const db = openDb(':memory:');
  assert.throws(() => seedGoal(db, { difficulty: 300 }), /CHECK/);
  assert.throws(() => seedGoal(db, { difficulty: 2300 }), /CHECK/);
  assert.throws(() => seedGoal(db, { category_id: 'cuisine' }), /FOREIGN KEY/);
  const { goalId } = seedGoal(db);
  assert.throws(() => db.prepare(`UPDATE goals SET status='paused' WHERE id=?`).run(goalId), /CHECK/);
  assert.throws(() => insEvent(db, { goal_id: goalId, kind: 'bonus', delta_elo: 1, elo_after: 1001 }), /CHECK/);
});

test('foreign keys are enforced on tasks', () => {
  const db = openDb(':memory:');
  assert.throws(
    () => db.prepare(`INSERT INTO tasks (step_id, label, ordre, xp) VALUES (999, 'x', 0, 10)`).run(),
    /FOREIGN KEY/,
  );
});

test('an event can be reverted only once', () => {
  const db = openDb(':memory:');
  const { goalId, stepId, taskId } = seedGoal(db);
  const id = insEvent(db, { goal_id: goalId, step_id: stepId, task_id: taskId, delta_xp: 50, delta_elo: 21, elo_after: 1021 }).lastInsertRowid;
  insEvent(db, { goal_id: goalId, step_id: stepId, task_id: taskId, delta_xp: -50, delta_elo: -21, elo_after: 1000, reverts_id: id });
  assert.throws(
    () => insEvent(db, { goal_id: goalId, task_id: taskId, delta_xp: -50, delta_elo: -21, elo_after: 979, reverts_id: id }),
    /UNIQUE/,
  );
});

test('a goal with ledger events cannot be hard-deleted', () => {
  const db = openDb(':memory:');
  const { goalId, stepId, taskId } = seedGoal(db);
  insEvent(db, { goal_id: goalId, step_id: stepId, task_id: taskId, delta_elo: 21, elo_after: 1021 });
  assert.throws(() => db.prepare(`DELETE FROM goals WHERE id=?`).run(goalId), /FOREIGN KEY/);
});

test('a goal without events cascades to its steps and tasks', () => {
  const db = openDb(':memory:');
  const { goalId } = seedGoal(db);
  db.prepare(`DELETE FROM goals WHERE id=?`).run(goalId);
  assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM steps`).get().n, 0);
  assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM tasks`).get().n, 0);
});

test('transaction: commits on success, rolls back everything on throw', () => {
  const db = openDb(':memory:');
  const id = transaction(db, () => seedGoal(db).goalId);
  assert.ok(id);
  assert.throws(() => transaction(db, () => {
    seedGoal(db);
    throw new Error('LLM plan invalid');
  }), /LLM plan invalid/);
  assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM goals`).get().n, 1);
  assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM tasks`).get().n, 1);
});
