// Hot copy of the database, safe while the server runs (SQLite online
// backup). Writes <db folder>/backups/elo-YYYY-MM-DD-HHMM.db and keeps the
// 14 most recent. In Docker: `node backup.js` (Coolify scheduled task).
import { DatabaseSync, backup } from 'node:sqlite';
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const KEEP = 14;
const source = process.env.ELO_DB_PATH || join(dirname(fileURLToPath(import.meta.url)), 'elo.db');
const dir = join(dirname(source), 'backups');
mkdirSync(dir, { recursive: true });

const stamp = new Date().toISOString().slice(0, 16).replace('T', '-').replace(':', '');
const target = join(dir, `elo-${stamp}.db`);
const db = new DatabaseSync(source, { readOnly: true });
await backup(db, target);
db.close();

const old = readdirSync(dir).filter((f) => /^elo-.*\.db$/.test(f)).sort().slice(0, -KEEP);
for (const f of old) rmSync(join(dir, f));
console.log(`backup: ${target}${old.length ? ` (${old.length} old removed)` : ''}`);
