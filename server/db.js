// SQLite via Node's built-in node:sqlite (Node >=22) — no native build step.
// Mono-user MVP: a single implicit user (id=1). Schema kept Postgres-friendly
// (simple types, explicit FKs) for the post-MVP multi-user migration.

import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const db = new DatabaseSync(join(__dirname, 'beynd.db'));

db.exec(`
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS user (
    id INTEGER PRIMARY KEY,
    poids_depart REAL,
    poids_cible REAL,
    taille REAL,
    niveau TEXT,
    dispo_par_semaine INTEGER,
    contraintes TEXT
  );

  CREATE TABLE IF NOT EXISTS project (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL DEFAULT 1,
    objectif TEXT,
    coach_id TEXT NOT NULL DEFAULT 'cool-jeune',
    date_debut TEXT NOT NULL,
    duree_semaines INTEGER NOT NULL DEFAULT 12,
    statut TEXT NOT NULL DEFAULT 'onboarding'
  );

  CREATE TABLE IF NOT EXISTS program (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    semaine INTEGER NOT NULL,
    plan_json TEXT NOT NULL,
    genere_le TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES project(id)
  );

  CREATE TABLE IF NOT EXISTS engagement (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    program_id INTEGER NOT NULL,
    jour TEXT,
    libelle TEXT NOT NULL,
    cible TEXT,
    fait INTEGER NOT NULL DEFAULT 0,
    date TEXT,
    FOREIGN KEY (program_id) REFERENCES program(id)
  );

  CREATE TABLE IF NOT EXISTS measurement (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    poids REAL NOT NULL,
    FOREIGN KEY (project_id) REFERENCES project(id)
  );

  CREATE TABLE IF NOT EXISTS message (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    role TEXT NOT NULL,            -- 'user' | 'coach'
    coach_id TEXT,                 -- author when role='coach' (switchable coach)
    contenu TEXT NOT NULL,
    data_card_json TEXT,
    timestamp TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES project(id)
  );
`);

// Ensure the singleton user row exists.
db.exec(`INSERT OR IGNORE INTO user (id) VALUES (1);`);

export function getActiveProject() {
  return db.prepare(`SELECT * FROM project ORDER BY id DESC LIMIT 1`).get();
}
