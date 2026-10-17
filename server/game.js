// Domain layer: reads and writes the DB, delegates every rule to engine.js.
// Routes (app.js) stay thin; everything here takes the db and a `now` Date so
// tests can pin the clock.

import { transaction, CATEGORIES } from './db.js';
import {
  START_ELO, round1, gain, tier, taskXp, level, checkEvents, revertEvents,
  lifeElo, streak, bestStreak,
} from './engine.js';

export class NotFound extends Error {}
export class Conflict extends Error {}

const QUEST_TASKS_PER_GOAL = 3;
const CATEGORY_NAMES = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.name]));

// The game day starts at DAY_START_HOUR (default 4 h), server local time:
// a task ticked at 1 h counts for the previous day, like a late night session.
const DEFAULT_DAY_START_HOUR = 4;

export function parseDayStartHour(raw) {
  if (raw === undefined || raw === '') return DEFAULT_DAY_START_HOUR;
  const h = Number(raw);
  if (Number.isInteger(h) && h >= 0 && h <= 23) return h;
  console.warn(`DAY_START_HOUR="${raw}" is not an hour 0–23, using ${DEFAULT_DAY_START_HOUR}`);
  return DEFAULT_DAY_START_HOUR;
}

export const DAY_START_HOUR = parseDayStartHour(process.env.DAY_START_HOUR);

// Built from local date parts (not by subtracting milliseconds) so a DST
// change night never shifts the result.
export function localDay(date, startHour = DAY_START_HOUR) {
  const d = date.getHours() < startHour
    ? new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1)
    : date;
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// --- reads -----------------------------------------------------------------
function categoryElo(db, categoryId) {
  const { s } = db.prepare(`SELECT COALESCE(SUM(delta_elo), 0) AS s FROM progress_events WHERE category_id = ?`).get(categoryId);
  return round1(START_ELO + s);
}

function allCategoryElos(db) {
  const sums = Object.fromEntries(
    db.prepare(`SELECT category_id, SUM(delta_elo) AS s FROM progress_events GROUP BY category_id`)
      .all().map((r) => [r.category_id, r.s]),
  );
  const withGoals = new Set(
    db.prepare(`SELECT DISTINCT category_id FROM goals WHERE status != 'archived'`).all().map((r) => r.category_id),
  );
  return CATEGORIES.map((c) => ({
    id: c.id,
    name: c.name,
    elo: round1(START_ELO + (sums[c.id] ?? 0)),
    active: withGoals.has(c.id),
  }));
}

function goalCounts(db, goalId) {
  return db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM steps WHERE goal_id = :g) AS steps_total,
      (SELECT COUNT(*) FROM steps WHERE goal_id = :g AND status = 'done') AS steps_done,
      (SELECT COUNT(*) FROM tasks t JOIN steps s ON s.id = t.step_id WHERE s.goal_id = :g) AS tasks_total,
      (SELECT COUNT(*) FROM tasks t JOIN steps s ON s.id = t.step_id WHERE s.goal_id = :g AND t.done_on IS NOT NULL) AS tasks_done
  `).get({ g: goalId });
}

function goalSummary(db, goal) {
  const elo = categoryElo(db, goal.category_id);
  const counts = goalCounts(db, goal.id);
  const current = db.prepare(`SELECT title FROM steps WHERE goal_id = ? AND status = 'todo' ORDER BY ordre LIMIT 1`).get(goal.id);
  const t = tier(goal.difficulty);
  return {
    id: goal.id,
    title: goal.title,
    category_id: goal.category_id,
    category_name: CATEGORY_NAMES[goal.category_id],
    difficulty: goal.difficulty,
    tier: { id: t.id, label: t.label },
    status: goal.status,
    is_main: Boolean(goal.is_main),
    coach_intro: goal.coach_intro,
    category_elo: elo,
    // What one step is worth right now (also the step bonus); the boss pays ×2.
    potential_gain: gain(goal.difficulty, elo),
    current_step: current?.title ?? null,
    progress: {
      ...counts,
      pct: counts.tasks_total ? Math.round((counts.tasks_done / counts.tasks_total) * 100) : 0,
    },
    created_at: goal.created_at,
    completed_at: goal.completed_at,
  };
}

function getGoalRow(db, id) {
  const goal = db.prepare(`SELECT * FROM goals WHERE id = ?`).get(id);
  if (!goal) throw new NotFound('goal not found');
  return goal;
}

export function listGoals(db, { category, archived = false } = {}) {
  const rows = db.prepare(`
    SELECT * FROM goals
     WHERE (:cat IS NULL OR category_id = :cat)
       AND ((:arch = 1 AND status = 'archived') OR (:arch = 0 AND status != 'archived'))
     ORDER BY is_main DESC, status = 'done', created_at, id
  `).all({ cat: category ?? null, arch: archived ? 1 : 0 });
  return rows.map((g) => goalSummary(db, g));
}

export function goalDetail(db, id) {
  const goal = getGoalRow(db, id);
  const steps = db.prepare(`SELECT * FROM steps WHERE goal_id = ? ORDER BY ordre`).all(goal.id);
  const tasksOf = db.prepare(`SELECT id, label, ordre, xp, done_on FROM tasks WHERE step_id = ? ORDER BY ordre`);
  return {
    ...goalSummary(db, goal),
    steps: steps.map((s) => ({
      id: s.id, title: s.title, ordre: s.ordre, status: s.status, completed_at: s.completed_at,
      tasks: tasksOf.all(s.id),
    })),
  };
}

// Daily quest: per goal (main first), what was ticked today — so it can be
// unticked — then the next undone tasks of the first unfinished step.
function quest(db, today) {
  const goals = db.prepare(`
    SELECT g.* FROM goals g
     WHERE g.status = 'active'
        OR (g.status = 'done' AND EXISTS (
             SELECT 1 FROM tasks t JOIN steps s ON s.id = t.step_id
              WHERE s.goal_id = g.id AND t.done_on = :today))
     ORDER BY g.is_main DESC, g.created_at, g.id
  `).all({ today });

  const doneToday = db.prepare(`
    SELECT t.*, s.title AS step_title, s.id AS step_id FROM tasks t JOIN steps s ON s.id = t.step_id
     WHERE s.goal_id = ? AND t.done_on = ? ORDER BY s.ordre, t.ordre`);
  const nextStep = db.prepare(`SELECT * FROM steps WHERE goal_id = ? AND status = 'todo' ORDER BY ordre LIMIT 1`);
  const nextTasks = db.prepare(`SELECT * FROM tasks WHERE step_id = ? AND done_on IS NULL ORDER BY ordre LIMIT ?`);
  const stepSize = db.prepare(`SELECT COUNT(*) AS n FROM tasks WHERE step_id = ?`);
  // What a ticked task actually earned: its still-active 'task' event.
  const earned = db.prepare(`
    SELECT e.delta_elo FROM progress_events e
     WHERE e.task_id = ? AND e.kind = 'task' AND e.reverts_id IS NULL
       AND NOT EXISTS (SELECT 1 FROM progress_events r WHERE r.reverts_id = e.id)
     ORDER BY e.id DESC LIMIT 1`);

  const items = [];
  for (const g of goals) {
    const elo = categoryElo(db, g.category_id);
    const item = (t, stepTitle, stepId) => ({
      task_id: t.id,
      label: t.label,
      xp: t.xp,
      done: t.done_on != null,
      goal_id: g.id,
      goal_title: g.title,
      category_id: g.category_id,
      step_title: stepTitle,
      // Undone: what it would earn now. Done: what it earned when ticked.
      elo_gain: t.done_on != null
        ? (earned.get(t.id)?.delta_elo ?? 0)
        : round1(gain(g.difficulty, elo) / stepSize.get(stepId).n),
    });
    for (const t of doneToday.all(g.id, today)) items.push(item(t, t.step_title, t.step_id));
    const step = nextStep.get(g.id);
    if (step) {
      for (const t of nextTasks.all(step.id, QUEST_TASKS_PER_GOAL)) items.push(item(t, step.title, step.id));
    }
  }
  return items;
}

function doneDates(db) {
  return db.prepare(`SELECT done_on FROM tasks WHERE done_on IS NOT NULL`).all().map((r) => r.done_on);
}

function userProfile(db, today) {
  const u = db.prepare(`SELECT id, name FROM user WHERE id = 1`).get();
  const { xp } = db.prepare(`SELECT COALESCE(SUM(delta_xp), 0) AS xp FROM progress_events`).get();
  return { ...u, xp, ...level(xp), streak: streak(doneDates(db), today) };
}

const eventsAsc = (db) =>
  db.prepare(`SELECT category_id, delta_elo, elo_after, created_at FROM progress_events ORDER BY id`).all();

// End-of-day Elo per category, starting from a 1000 point before the first event.
function categorySeries(events, categoryId) {
  const byDay = new Map();
  for (const e of events) if (e.category_id === categoryId) byDay.set(localDay(new Date(e.created_at)), e.elo_after);
  return [...byDay].map(([date, elo]) => ({ date, elo }));
}

// End-of-day life Elo over the categories that currently count.
function lifeSeries(events, activeIds) {
  const current = Object.fromEntries(activeIds.map((id) => [id, START_ELO]));
  const byDay = new Map();
  for (const e of events) {
    if (!(e.category_id in current)) continue;
    current[e.category_id] = e.elo_after;
    byDay.set(localDay(new Date(e.created_at)), lifeElo(Object.values(current)));
  }
  return [...byDay].map(([date, elo]) => ({ date, elo }));
}

export function homeState(db, now) {
  const today = localDay(now);
  const events = eventsAsc(db);

  // Net Elo change of the current game day, per category.
  const todayDelta = {};
  for (const e of events) {
    if (localDay(new Date(e.created_at)) !== today) continue;
    todayDelta[e.category_id] = round1((todayDelta[e.category_id] ?? 0) + e.delta_elo);
  }
  const categories = allCategoryElos(db).map((c) => ({ ...c, delta_today: todayDelta[c.id] ?? 0 }));
  const active = categories.filter((c) => c.active);

  const life = lifeElo(active.map((c) => c.elo));
  const series = lifeSeries(events, active.map((c) => c.id));
  const before = series.filter((p) => p.date < today).at(-1)?.elo ?? START_ELO;
  const main = db.prepare(`SELECT * FROM goals WHERE is_main = 1 AND status != 'archived' LIMIT 1`).get();
  return {
    today,
    user: userProfile(db, today),
    life_elo: { value: life, delta_today: round1(life - before), series },
    categories,
    quest: quest(db, today),
    main_goal: main ? goalSummary(db, main) : null,
  };
}

export function progressState(db, now) {
  const today = localDay(now);
  const events = eventsAsc(db);
  const used = new Set(events.map((e) => e.category_id));
  const categories = allCategoryElos(db)
    .filter((c) => c.active || used.has(c.id))
    .map((c) => ({ ...c, series: categorySeries(events, c.id) }));

  // Net Elo and XP per day (cancellations included), plus the tasks still ticked.
  const days = new Map();
  const day = (d) => {
    if (!days.has(d)) days.set(d, { date: d, elo_delta: 0, xp: 0, tasks: [] });
    return days.get(d);
  };
  for (const e of db.prepare(`SELECT delta_elo, delta_xp, created_at FROM progress_events`).all()) {
    const d = day(localDay(new Date(e.created_at)));
    d.elo_delta = round1(d.elo_delta + e.delta_elo);
    d.xp += e.delta_xp;
  }
  const ticked = db.prepare(`
    SELECT t.done_on, t.label, g.title AS goal_title, g.category_id FROM tasks t
      JOIN steps s ON s.id = t.step_id JOIN goals g ON g.id = s.goal_id
     WHERE t.done_on IS NOT NULL ORDER BY t.done_on, s.ordre, t.ordre`).all();
  for (const t of ticked) day(t.done_on).tasks.push({ label: t.label, goal_title: t.goal_title, category_id: t.category_id });

  const dates = doneDates(db);
  return {
    categories,
    history: [...days.values()].sort((a, b) => b.date.localeCompare(a.date)),
    streak: { current: streak(dates, today), best: bestStreak(dates) },
  };
}

// --- writes ----------------------------------------------------------------
// `plan` is an already-validated coach proposal (possibly edited by the user).
export function createGoal(db, plan, { prompt = null, now }) {
  return transaction(db, () => {
    const hasMain = db.prepare(`SELECT 1 FROM goals WHERE is_main = 1 AND status != 'archived'`).get();
    const goalId = db.prepare(`
      INSERT INTO goals (category_id, title, prompt, difficulty, coach_intro, is_main, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(plan.category, plan.title, prompt, plan.difficulty, plan.intro || null, hasMain ? 0 : 1, now.toISOString()).lastInsertRowid;

    const xp = taskXp(plan.difficulty);
    const insStep = db.prepare(`INSERT INTO steps (goal_id, title, ordre) VALUES (?, ?, ?)`);
    const insTask = db.prepare(`INSERT INTO tasks (step_id, label, ordre, xp) VALUES (?, ?, ?, ?)`);
    plan.steps.forEach((s, i) => {
      const stepId = insStep.run(goalId, s.title, i).lastInsertRowid;
      s.tasks.forEach((label, j) => insTask.run(stepId, label, j, xp));
    });
    return goalDetail(db, goalId);
  });
}

export function updateGoal(db, id, patch, { now }) {
  return transaction(db, () => {
    const goal = getGoalRow(db, id);
    if (patch.title !== undefined) {
      const title = String(patch.title).replace(/\s+/g, ' ').trim().slice(0, 80);
      if (!title) throw new Conflict('title cannot be empty');
      db.prepare(`UPDATE goals SET title = ? WHERE id = ?`).run(title, id);
    }
    if (patch.status === 'archived') {
      db.prepare(`UPDATE goals SET status = 'archived', is_main = 0 WHERE id = ?`).run(id);
    } else if (patch.status === 'active' && goal.status === 'archived') {
      // Unarchive back to whatever the steps say.
      const { steps_total, steps_done } = goalCounts(db, id);
      const done = steps_total > 0 && steps_done === steps_total;
      db.prepare(`UPDATE goals SET status = ? WHERE id = ?`).run(done ? 'done' : 'active', id);
    } else if (patch.status !== undefined && patch.status !== goal.status) {
      throw new Conflict(`cannot set status to ${patch.status}`);
    }
    if (patch.is_main === true) {
      if (getGoalRow(db, id).status === 'archived') throw new Conflict('an archived goal cannot be main');
      db.prepare(`UPDATE goals SET is_main = 0 WHERE is_main = 1`).run();
      db.prepare(`UPDATE goals SET is_main = 1 WHERE id = ?`).run(id);
    }
    // Never leave the home screen without a main goal while one could be.
    if (!db.prepare(`SELECT 1 FROM goals WHERE is_main = 1`).get()) {
      db.prepare(`
        UPDATE goals SET is_main = 1 WHERE id = (
          SELECT id FROM goals WHERE status != 'archived' ORDER BY status = 'done', created_at, id LIMIT 1)
      `).run();
    }
    return goalDetail(db, id);
  });
}

const activeEventsFor = (db) => db.prepare(`
  SELECT e.* FROM progress_events e
   WHERE e.reverts_id IS NULL
     AND NOT EXISTS (SELECT 1 FROM progress_events r WHERE r.reverts_id = e.id)
     AND ((e.kind = 'task' AND e.task_id = :task)
       OR (e.kind = 'step_bonus' AND e.step_id = :step)
       OR (e.kind = 'boss' AND e.goal_id = :goal))
`);

// Tick or untick one task. Returns the events written (for celebrations).
export function toggleTask(db, taskId, { now }) {
  return transaction(db, () => {
    const task = db.prepare(`SELECT * FROM tasks WHERE id = ?`).get(taskId);
    if (!task) throw new NotFound('task not found');
    const step = db.prepare(`SELECT * FROM steps WHERE id = ?`).get(task.step_id);
    const goal = getGoalRow(db, step.goal_id);
    if (goal.status === 'archived') throw new Conflict('goal is archived');

    const at = now.toISOString();
    const elo = categoryElo(db, goal.category_id);
    let events;

    if (task.done_on == null) {
      const { n, done } = db.prepare(
        `SELECT COUNT(*) AS n, COUNT(done_on) AS done FROM tasks WHERE step_id = ?`
      ).get(step.id);
      const stepCompleted = done + 1 === n;
      const { open } = db.prepare(
        `SELECT COUNT(*) AS open FROM steps WHERE goal_id = ? AND status = 'todo' AND id != ?`
      ).get(goal.id, step.id);
      const goalCompleted = stepCompleted && open === 0;

      events = checkEvents({ difficulty: goal.difficulty, elo, taskCount: n, xp: task.xp, stepCompleted, goalCompleted });
      db.prepare(`UPDATE tasks SET done_on = ? WHERE id = ?`).run(localDay(now), task.id);
      if (stepCompleted) db.prepare(`UPDATE steps SET status = 'done', completed_at = ? WHERE id = ?`).run(at, step.id);
      if (goalCompleted) db.prepare(`UPDATE goals SET status = 'done', completed_at = ? WHERE id = ?`).run(at, goal.id);
    } else {
      const toRevert = activeEventsFor(db).all({ task: task.id, step: step.id, goal: goal.id });
      events = revertEvents({ elo, events: toRevert });
      db.prepare(`UPDATE tasks SET done_on = NULL WHERE id = ?`).run(task.id);
      db.prepare(`UPDATE steps SET status = 'todo', completed_at = NULL WHERE id = ?`).run(step.id);
      db.prepare(`UPDATE goals SET status = 'active', completed_at = NULL WHERE id = ?`).run(goal.id);
    }

    const ins = db.prepare(`
      INSERT INTO progress_events (category_id, goal_id, step_id, task_id, kind, delta_xp, delta_elo, elo_after, reverts_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const e of events) {
      ins.run(goal.category_id, goal.id, step.id, task.id, e.kind, e.delta_xp, e.delta_elo, e.elo_after, e.reverts_id ?? null, at);
    }
    return { done: task.done_on == null, events };
  });
}
