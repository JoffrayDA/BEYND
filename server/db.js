// SQLite via Node's built-in node:sqlite (Node >=22) — no native build step.
// Mono-user MVP: a single implicit user (id=1). Schema kept Postgres-friendly
// (simple types, explicit FKs). See docs/ARCHITECTURE.md §2.
//
// progress_events is the single source of truth for Elo, XP, level and streak:
// rows are only ever appended (a cancellation is a new row with reverts_id).

import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  DIFFICULTY_MIN, DIFFICULTY_MAX, PER_WEEK_MIN, PER_WEEK_MAX, BOSS_WEEKS_MIN, BOSS_WEEKS_MAX,
} from './engine.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const CATEGORIES = [
  { id: 'tech', name: 'Tech' },
  { id: 'langues', name: 'Langues' },
  { id: 'sport', name: 'Sport' },
  { id: 'carriere', name: 'Carrière' },
  { id: 'creatif', name: 'Créatif' },
  { id: 'autre', name: 'Autre' },
];

const EVENT_KINDS = ['task', 'step_bonus', 'boss', 'session', 'week_bonus', 'milestone', 'demo'];

const eventsTable = (name) => `CREATE TABLE IF NOT EXISTS ${name} (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL DEFAULT 1 REFERENCES user(id),
    category_id TEXT NOT NULL REFERENCES categories(id),
    goal_id INTEGER NOT NULL REFERENCES goals(id),
    step_id INTEGER REFERENCES steps(id),
    task_id INTEGER REFERENCES tasks(id),
    habit_id INTEGER REFERENCES habits(id),
    week TEXT,                             -- Monday (ISO) for routine events
    kind TEXT NOT NULL CHECK (kind IN (${EVENT_KINDS.map((k) => `'${k}'`).join(', ')})),
    delta_xp INTEGER NOT NULL DEFAULT 0,
    delta_elo REAL NOT NULL,
    elo_after REAL NOT NULL,
    reverts_id INTEGER UNIQUE REFERENCES ${name}(id),
    created_at TEXT NOT NULL
  );`;
const EVENTS_TABLE = eventsTable('progress_events') + ';';

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
    kind TEXT NOT NULL DEFAULT 'project' CHECK (kind IN ('project', 'routine')),
    title TEXT NOT NULL,
    prompt TEXT,                   -- what the user typed, kept for re-analysis
    difficulty INTEGER NOT NULL CHECK (difficulty BETWEEN ${DIFFICULTY_MIN} AND ${DIFFICULTY_MAX}),
    coach_intro TEXT,
    boss_weeks INTEGER CHECK (boss_weeks BETWEEN ${BOSS_WEEKS_MIN} AND ${BOSS_WEEKS_MAX}),
    level_up_snoozed_until TEXT,
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

  -- Routine habits: one session a game day at most (UNIQUE habit_id, day).
  CREATE TABLE IF NOT EXISTS habits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    goal_id INTEGER NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    per_week INTEGER NOT NULL CHECK (per_week BETWEEN ${PER_WEEK_MIN} AND ${PER_WEEK_MAX}),
    ordre INTEGER NOT NULL,
    xp INTEGER NOT NULL CHECK (xp >= 0)
  );

  CREATE TABLE IF NOT EXISTS habit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    habit_id INTEGER NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
    day TEXT NOT NULL,
    UNIQUE (habit_id, day)
  );

  -- No ON DELETE CASCADE here on purpose: the ledger is append-only, so a
  -- goal that already produced events cannot be hard-deleted (archive it).
  ${EVENTS_TABLE}
`;

const INDEXES = `

  CREATE INDEX IF NOT EXISTS idx_goals_category ON goals(category_id);
  CREATE INDEX IF NOT EXISTS idx_steps_goal ON steps(goal_id, ordre);
  CREATE INDEX IF NOT EXISTS idx_tasks_step ON tasks(step_id, ordre);
  CREATE INDEX IF NOT EXISTS idx_tasks_done_on ON tasks(done_on);
  CREATE INDEX IF NOT EXISTS idx_events_category ON progress_events(category_id, id);
  CREATE INDEX IF NOT EXISTS idx_events_task ON progress_events(task_id);
  CREATE INDEX IF NOT EXISTS idx_events_habit ON progress_events(habit_id);
  CREATE INDEX IF NOT EXISTS idx_habits_goal ON habits(goal_id, ordre);
  CREATE INDEX IF NOT EXISTS idx_habit_logs_day ON habit_logs(day);
`;

// Opens (and initialises, idempotently) a database. Tests pass ':memory:'.
export function openDb(path = join(__dirname, 'elo.db')) {
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;`);
  db.exec(SCHEMA);
  migrate(db);
  db.exec(INDEXES);

  const insCat = db.prepare(`INSERT OR IGNORE INTO categories (id, name, ordre) VALUES (?, ?, ?)`);
  CATEGORIES.forEach((c, i) => insCat.run(c.id, c.name, i));
  db.prepare(`INSERT OR IGNORE INTO user (id, created_at) VALUES (1, ?)`).run(new Date().toISOString());
  return db;
}

// Bases created before routines (É9): goals gain kind / boss_weeks /
// level_up_snoozed_until, and progress_events is rebuilt once because SQLite
// cannot alter a CHECK. Old demo:xp rows (task kind, no task) become 'demo'.
function migrate(db) {
  addColumn(db, 'goals', 'kind', `TEXT NOT NULL DEFAULT 'project' CHECK (kind IN ('project', 'routine'))`);
  addColumn(db, 'goals', 'boss_weeks', `INTEGER CHECK (boss_weeks BETWEEN ${BOSS_WEEKS_MIN} AND ${BOSS_WEEKS_MAX})`);
  addColumn(db, 'goals', 'level_up_snoozed_until', 'TEXT');

  const cols = db.prepare(`PRAGMA table_info(progress_events)`).all().map((c) => c.name);
  if (cols.includes('habit_id')) return;
  db.exec('PRAGMA foreign_keys = OFF');
  try {
    transaction(db, () => {
      db.exec(eventsTable('progress_events_new'));
      db.exec(`
        INSERT INTO progress_events_new
          (id, user_id, category_id, goal_id, step_id, task_id, kind, delta_xp, delta_elo, elo_after, reverts_id, created_at)
        SELECT id, user_id, category_id, goal_id, step_id, task_id,
               CASE WHEN kind = 'task' AND task_id IS NULL THEN 'demo' ELSE kind END,
               delta_xp, delta_elo, elo_after, reverts_id, created_at
          FROM progress_events ORDER BY id;
        DROP TABLE progress_events;
        ALTER TABLE progress_events_new RENAME TO progress_events;
      `);
    });
  } finally {
    db.exec('PRAGMA foreign_keys = ON');
  }
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
