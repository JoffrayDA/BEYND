import { serve } from '@hono/node-server';
import { openDb } from './db.js';
import { createApp } from './app.js';
import { HAS_KEY } from './llm.js';

// ELO_DB_PATH lets manual test runs use a throwaway database.
const db = process.env.ELO_DB_PATH ? openDb(process.env.ELO_DB_PATH) : openDb();
const app = createApp({ db });

const port = Number(process.env.PORT) || 8787;
serve({ fetch: app.fetch, port });
console.log(`Elo de vie server on :${port}  (LLM key: ${HAS_KEY ? 'yes' : 'no — mock mode'})`);
