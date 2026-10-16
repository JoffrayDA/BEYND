// SQLite via Node's built-in node:sqlite (Node >=22) — no native build step.
// Mono-user MVP: a single implicit user (id=1). Schema kept Postgres-friendly
// (simple types, explicit FKs). See docs/ARCHITECTURE.md §2.
//
// progress_events is the single source of truth for Elo, XP, level and streak:
// rows are only ever appended (a cancellation is a new row with reverts_id).

import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { DIFFICULTY_MIN, DIFFICULTY_MAX } from './engine.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const CATEGORIES = [
  { id: 'tech', name: 'Tech' },
  { id: 'langues', name: 'Langues' },
  { id: 'sport', name: 'Sport' },
  { id: 'carriere', name: 'Carrière' },
  { id: 'creatif', name: 'Créatif' },
  { id: 'autre', name: 'Autre' },
];

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS user (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL DEFAULT 'Joueur',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    ordre INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL DEFAULT 1 REFERENCES user(id),
    category_id TEXT NOT NULL REFERENCES categories(id),
    title TEXT NOT NULL,
    prompt TEXT,                   -- what the user typed, kept for re-analysis
    difficulty INTEGER NOT NULL CHECK (difficulty BETWEEN ${DIFFICULTY_MIN} AND ${DIFFICULTY_MAX}),
    coach_intro TEXT,
    is_main INTEGER NOT NULL DEFAULT 0 CHECK (is_main IN (0, 1)),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'done', 'archived')),
    created_at TEXT NOT NULL,
    completed_at TEXT
  );

  CREATE TABLE IF NOT EXISTS steps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    goal_id INTEGER NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    ordre INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'done')),
    completed_at TEXT
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    step_id INTEGER NOT NULL REFERENCES steps(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    ordre INTEGER NOT NULL,
    xp INTEGER NOT NULL CHECK (xp >= 0),   -- fixed at creation from the goal's tier
    done_on TEXT                           -- ISO date, NULL while not done
  );

  -- No ON DELETE CASCADE here on purpose: the ledger is append-only, so a
  -- goal that already produced events cannot be hard-deleted (archive it).
  CREATE TABLE IF NOT EXISTS progress_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL DEFAULT 1 REFERENCES user(id),
    category_id TEXT NOT NULL REFERENCES categories(id),
    goal_id INTEGER NOT NULL REFERENCES goals(id),
    step_id INTEGER REFERENCES steps(id),
    task_id INTEGER REFERENCES tasks(id),
    kind TEXT NOT NULL CHECK (kind IN ('task', 'step_bonus', 'boss')),
    delta_xp INTEGER NOT NULL DEFAULT 0,
    delta_elo REAL NOT NULL,
    elo_after REAL NOT NULL,
    reverts_id INTEGER UNIQUE REFERENCES progress_events(id),
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_goals_category ON goals(category_id);
  CREATE INDEX IF NOT EXISTS idx_steps_goal ON steps(goal_id, ordre);
  CREATE INDEX IF NOT EXISTS idx_tasks_step ON tasks(step_id, ordre);
  CREATE INDEX IF NOT EXISTS idx_tasks_done_on ON tasks(done_on);
  CREATE INDEX IF NOT EXISTS idx_events_category ON progress_events(category_id, id);
  CREATE INDEX IF NOT EXISTS idx_events_task ON progress_events(task_id);
`;

// Opens (and initialises, idempotently) a database. Tests pass ':memory:'.
export function openDb(path = join(__dirname, 'elo.db')) {
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;`);
  db.exec(SCHEMA);

  const insCat = db.prepare(`INSERT OR IGNORE INTO categories (id, name, ordre) VALUES (?, ?, ?)`);
  CATEGORIES.forEach((c, i) => insCat.run(c.id, c.name, i));
  db.prepare(`INSERT OR IGNORE INTO user (id, created_at) VALUES (1, ?)`).run(new Date().toISOString());
  return db;
}

// node:sqlite has no transaction helper. Runs fn inside BEGIN/COMMIT and
// rolls back on any throw, so a multi-row write is all-or-nothing.
export function transaction(db, fn) {
  db.exec('BEGIN');
  try {
    const out = fn();
    db.exec('COMMIT');
    return out;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

// SQLite has no ADD COLUMN IF NOT EXISTS; check the table shape first.
export function addColumn(db, table, column, decl) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (cols.some((c) => c.name === column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${decl}`);
}
