import { serve } from '@hono/node-server';
import { openDb } from './db.js';
import { createApp } from './app.js';
import { existsSync } from 'node:fs';
import { HAS_KEY } from './llm.js';

// ELO_DB_PATH lets manual test runs use a throwaway database.
const db = process.env.ELO_DB_PATH ? openDb(process.env.ELO_DB_PATH) : openDb();
// The built client (npm run build in client/) is served when present, so one
// process serves the whole app in production. CLIENT_DIST overrides the path.
const clientDir = process.env.CLIENT_DIST || '../client/dist';
const app = createApp({ db, clientDir: existsSync(clientDir) ? clientDir : null });

const port = Number(process.env.PORT) || 8787;
const server = serve({ fetch: app.fetch, port });

// Docker stops the container with SIGTERM: close the database cleanly.
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => server.close(() => { db.close(); process.exit(0); }));
}
console.log(`BEYND server on :${port}  (LLM key: ${HAS_KEY ? 'yes' : 'no — mock mode'}, password: ${process.env.APP_PASSWORD ? 'on' : 'off'}${existsSync(clientDir) ? `, client: ${clientDir}` : ''})`);
