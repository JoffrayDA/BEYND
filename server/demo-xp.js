// Dev-only: grant XP to preview the level-up celebration.
//   npm run demo:xp            → 5 XP short of the next level (next tick levels up)
//   npm run demo:xp -- 1500    → exactly 1500 XP
// Uses ELO_DB_PATH when set, like the server.
import { openDb } from './db.js';
import { grantDemoXp } from './game.js';

const db = process.env.ELO_DB_PATH ? openDb(process.env.ELO_DB_PATH) : openDb();
const raw = process.argv[2];
try {
  const { granted, user } = grantDemoXp(db, raw === undefined ? undefined : Number(raw), { now: new Date() });
  console.log(`+${granted} XP → niveau ${user.level}, ${user.xpInLevel}/${user.xpForNext} XP. Coche une tâche dans l'app (rafraîchis l'Accueil).`);
} catch (err) {
  console.error(err.message === 'create a goal first' ? 'Aucun objectif : crée-en un dans l’app d’abord.' : err.message);
  process.exitCode = 1;
}
