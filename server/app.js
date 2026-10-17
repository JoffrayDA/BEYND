// HTTP routes. Built by a factory so tests can inject an in-memory db, a
// mock coach and a pinned clock. See docs/ARCHITECTURE.md §5.

import { Hono } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static';
import { createAuth } from './auth.js';
import { analyzeGoal, validatePlan, CoachError, HAS_KEY } from './llm.js';
import {
  NotFound, Conflict, homeState, progressState, listGoals, goalDetail,
  createGoal, updateGoal, toggleTask, toggleHabit, toggleMilestone, levelUpRoutine,
} from './game.js';
import { CATEGORIES } from './db.js';
import { gain, tier, taskXp } from './engine.js';

const MAX_PROMPT = 500;

// `password` turns the login gate on (see auth.js). `clientDir` serves the
// built PWA from the same origin, as in production (Docker).
export function createApp({
  db, analyze = analyzeGoal, clock = () => new Date(), hasKey = HAS_KEY,
  password = process.env.APP_PASSWORD, sessionSecret = process.env.SESSION_SECRET, clientDir = null,
}) {
  const app = new Hono();
  const auth = createAuth({ password, secret: sessionSecret, clock });
  app.use('/api/*', auth.middleware);
  auth.routes(app);

  const body = (c) => c.req.json().catch(() => ({}));
  const idParam = (c) => {
    const id = Number(c.req.param('id'));
    if (!Number.isInteger(id) || id <= 0) throw new NotFound('bad id');
    return id;
  };

  app.get('/api/state', (c) => c.json({ hasKey, auth: auth.enabled, ...homeState(db, clock()) }));

  app.get('/api/progress', (c) => c.json(progressState(db, clock())));

  // Coach proposal, nothing persisted. The preview fields let the client show
  // the tier, the XP per task and what a step is worth at the current Elo.
  app.post('/api/goals/analyze', async (c) => {
    const prompt = String((await body(c)).prompt ?? '').trim();
    if (!prompt) return c.json({ error: 'prompt required' }, 400);
    if (prompt.length > MAX_PROMPT) return c.json({ error: `prompt longer than ${MAX_PROMPT} chars` }, 400);
    try {
      const plan = await analyze({ prompt });
      const state = homeState(db, clock());
      const elo = state.categories.find((cat) => cat.id === plan.category).elo;
      const t = tier(plan.difficulty);
      return c.json({
        prompt,
        proposal: plan,
        preview: {
          tier: { id: t.id, label: t.label },
          xp_per_task: taskXp(plan.difficulty),
          category_elo: elo,
          potential_gain: gain(plan.difficulty, elo),
        },
      });
    } catch (err) {
      if (err instanceof CoachError) return c.json({ error: 'coach unavailable' }, 502);
      throw err;
    }
  });

  // Persist a proposal the user confirmed (possibly edited): re-validated
  // server-side, since it comes back from the client.
  app.post('/api/goals', async (c) => {
    const b = await body(c);
    let plan;
    try {
      plan = validatePlan(b.proposal ?? b, b.prompt ?? '');
    } catch (err) {
      if (err instanceof CoachError) return c.json({ error: `invalid plan: ${err.message}` }, 400);
      throw err;
    }
    if (!plan.title) return c.json({ error: 'invalid plan: title required' }, 400);
    const goal = createGoal(db, plan, { prompt: b.prompt ? String(b.prompt).slice(0, MAX_PROMPT) : null, now: clock() });
    return c.json({ goal }, 201);
  });

  app.get('/api/goals', (c) => {
    const category = c.req.query('category') || undefined;
    if (category && !CATEGORIES.some((cat) => cat.id === category)) return c.json({ error: 'unknown category' }, 400);
    return c.json({ goals: listGoals(db, { category, archived: c.req.query('archived') === '1', now: clock() }) });
  });

  app.get('/api/goals/:id', (c) => c.json({ goal: goalDetail(db, idParam(c), clock()) }));

  app.patch('/api/goals/:id', async (c) => {
    const b = await body(c);
    const patch = {};
    if ('title' in b) patch.title = b.title;
    if ('status' in b) patch.status = b.status;
    if (b.is_main === true) patch.is_main = true;
    return c.json({ goal: updateGoal(db, idParam(c), patch, { now: clock() }) });
  });

  // Every toggle answers the same way: the events written (for the
  // celebrations) and the new home state.
  const toggleRoute = (path, fn) => app.post(path, (c) => {
    const now = clock();
    const result = fn(db, idParam(c), { now });
    return c.json({ ...result, state: homeState(db, now) });
  });
  toggleRoute('/api/tasks/:id/toggle', toggleTask);
  toggleRoute('/api/habits/:id/toggle', toggleHabit);
  toggleRoute('/api/milestones/:id/toggle', toggleMilestone);

  app.post('/api/goals/:id/level-up', async (c) => {
    const now = clock();
    const goal = levelUpRoutine(db, idParam(c), await body(c), { now });
    return c.json({ goal, state: homeState(db, now) });
  });

  app.all('/api/*', (c) => c.json({ error: 'not found' }, 404));

  if (clientDir) {
    // Hashed bundles are immutable; index.html and the service worker must
    // be revalidated so a deploy reaches the phones.
    app.use('/*', async (c, next) => {
      await next();
      if (c.res.ok) c.res.headers.set('cache-control', c.req.path.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache');
    });
    app.use('/*', serveStatic({ root: clientDir }));
    app.get('/*', serveStatic({ root: clientDir, path: 'index.html' }));   // SPA fallback
  }

  app.onError((err, c) => {
    if (err instanceof NotFound) return c.json({ error: err.message }, 404);
    if (err instanceof Conflict) return c.json({ error: err.message }, 409);
    console.error(err);
    return c.json({ error: 'internal error' }, 500);
  });

  return app;
}
