// Domain layer: reads and writes the DB, delegates every rule to engine.js.
// Routes (app.js) stay thin; everything here takes the db and a `now` Date so
// tests can pin the clock.

import { transaction, CATEGORIES } from './db.js';
import {
  START_ELO, round1, gain, tier, taskXp, level, checkEvents, revertEvents,
  lifeElo, streak, bestStreak, XP_PER_LEVEL,
  weekStart, weekStreak, addDays, sessionEvents, milestoneEvent, canLevelUp, levelUpDifficulty,
  DIFFICULTY_MAX, PER_WEEK_MAX,
} from './engine.js';
import {
  MONSTERS, ACCESSORIES, SLOTS, plannedXp, raidHp, raidBonus, pickReward, pickSpecies,
  assaultDay, raidStatus, raidDamage,
} from './raid.js';

export class NotFound extends Error {}
export class Conflict extends Error {}
export class BadInput extends Error {}

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

// A still-active event: not a cancellation, and not cancelled.
const ACTIVE = `e.reverts_id IS NULL AND NOT EXISTS (SELECT 1 FROM progress_events r WHERE r.reverts_id = e.id)`;

const habitsOf = (db, goalId) =>
  db.prepare(`SELECT * FROM habits WHERE goal_id = ? ORDER BY ordre, id`).all(goalId);

// Sessions per habit in the week starting `week` (Monday ISO).
function weekCounts(db, goalId, week) {
  const rows = db.prepare(`
    SELECT l.habit_id, COUNT(*) AS n FROM habit_logs l JOIN habits h ON h.id = l.habit_id
     WHERE h.goal_id = ? AND l.day BETWEEN ? AND ? GROUP BY l.habit_id`).all(goalId, week, addDays(week, 6));
  return new Map(rows.map((r) => [r.habit_id, r.n]));
}

// Weeks held = weeks whose week_bonus is still active (the ledger decides,
// so changing a frequency later never rewrites past weeks).
const heldWeeks = (db, goalId) =>
  db.prepare(`SELECT e.week FROM progress_events e WHERE e.goal_id = ? AND e.kind = 'week_bonus' AND ${ACTIVE}`)
    .all(goalId).map((r) => r.week);

const activeOf = (db, goalId, kind, week = null) => db.prepare(`
  SELECT e.* FROM progress_events e
   WHERE e.goal_id = :g AND e.kind = :k AND (:w IS NULL OR e.week = :w) AND ${ACTIVE}
   ORDER BY e.id DESC LIMIT 1`).get({ g: goalId, k: kind, w: week });

function routineSummary(db, goal, today, elo) {
  const week = weekStart(today);
  const counts = weekCounts(db, goal.id, week);
  const doneToday = new Set(db.prepare(`
    SELECT l.habit_id FROM habit_logs l JOIN habits h ON h.id = l.habit_id WHERE h.goal_id = ? AND l.day = ?`)
    .all(goal.id, today).map((r) => r.habit_id));
  const habits = habitsOf(db, goal.id).map((h) => ({
    id: h.id, label: h.label, per_week: h.per_week, xp: h.xp,
    week_count: counts.get(h.id) ?? 0, done_today: doneToday.has(h.id),
  }));
  const W = habits.reduce((a, h) => a + h.per_week, 0);
  const weeks = heldWeeks(db, goal.id);
  return {
    habits,
    sessions_per_week: W,
    week: {
      start: week,
      done: habits.reduce((a, h) => a + Math.min(h.week_count, h.per_week), 0),
      target: W,
      held: weeks.includes(week),
    },
    weeks_streak: weekStreak(weeks, week),
    boss_weeks: goal.boss_weeks,
    boss_done: Boolean(activeOf(db, goal.id, 'boss')),
    session_gain: W ? round1(gain(goal.difficulty, elo) / W) : 0,
  };
}

function goalSummary(db, goal, today) {
  const elo = categoryElo(db, goal.category_id);
  const counts = goalCounts(db, goal.id);
  const current = db.prepare(`SELECT title FROM steps WHERE goal_id = ? AND status = 'todo' ORDER BY ordre LIMIT 1`).get(goal.id);
  const t = tier(goal.difficulty);
  const routine = goal.kind === 'routine' ? routineSummary(db, goal, today, elo) : null;
  // Routine progress = the run of held weeks toward the boss.
  const pct = routine
    ? (routine.boss_done ? 100 : Math.round((Math.min(routine.weeks_streak, goal.boss_weeks) / goal.boss_weeks) * 100))
    : counts.tasks_total ? Math.round((counts.tasks_done / counts.tasks_total) * 100) : 0;
  return {
    id: goal.id,
    kind: goal.kind,
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
    current_step: routine ? null : current?.title ?? null,
    progress: { ...counts, pct },
    routine,
    can_level_up: routine != null && goal.status === 'active' && canLevelUp(goal.difficulty, elo),
    created_at: goal.created_at,
    completed_at: goal.completed_at,
  };
}

function getGoalRow(db, id) {
  const goal = db.prepare(`SELECT * FROM goals WHERE id = ?`).get(id);
  if (!goal) throw new NotFound('goal not found');
  return goal;
}

export function listGoals(db, { category, archived = false, now = new Date() } = {}) {
  const rows = db.prepare(`
    SELECT * FROM goals
     WHERE (:cat IS NULL OR category_id = :cat)
       AND ((:arch = 1 AND status = 'archived') OR (:arch = 0 AND status != 'archived'))
     ORDER BY is_main DESC, status = 'done', created_at, id
  `).all({ cat: category ?? null, arch: archived ? 1 : 0 });
  const today = localDay(now);
  return rows.map((g) => goalSummary(db, g, today));
}

export function goalDetail(db, id, now = new Date()) {
  const goal = getGoalRow(db, id);
  const steps = db.prepare(`SELECT * FROM steps WHERE goal_id = ? ORDER BY ordre`).all(goal.id);
  const tasksOf = db.prepare(`SELECT id, label, ordre, xp, done_on FROM tasks WHERE step_id = ? ORDER BY ordre`);
  return {
    ...goalSummary(db, goal, localDay(now)),
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
    if (g.kind === 'routine') {
      items.push(...routineQuest(db, g, today, elo));
      continue;
    }
    const item = (t, stepTitle, stepId) => ({
      type: 'task',
      key: `t${t.id}`,
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

// Routine habits not done today while the week is short of their target,
// plus today's sessions so they can be unticked.
function routineQuest(db, g, today, elo) {
  const r = routineSummary(db, g, today, elo);
  const earned = db.prepare(`
    SELECT e.delta_elo, e.created_at FROM progress_events e
     WHERE e.habit_id = ? AND e.kind = 'session' AND e.week = ? AND ${ACTIVE} ORDER BY e.id DESC`);
  return r.habits
    .filter((h) => h.done_today || h.week_count < h.per_week)
    .map((h) => ({
      type: 'habit',
      key: `h${h.id}`,
      habit_id: h.id,
      label: h.label,
      xp: h.xp,
      done: h.done_today,
      goal_id: g.id,
      goal_title: g.title,
      category_id: g.category_id,
      step_title: null,
      week_count: h.week_count,
      per_week: h.per_week,
      elo_gain: h.done_today
        ? (earned.all(h.id, r.week.start).find((e) => localDay(new Date(e.created_at)) === today)?.delta_elo ?? 0)
        : r.session_gain,
    }));
}

// Routines whose category Elo passed their difficulty: the quest offers to
// raise the bar, unless that was snoozed.
function levelUps(db, today) {
  return db.prepare(`
    SELECT * FROM goals WHERE kind = 'routine' AND status = 'active'
       AND (level_up_snoozed_until IS NULL OR level_up_snoozed_until <= ?)
     ORDER BY is_main DESC, created_at, id`).all(today)
    .map((g) => ({ g, elo: categoryElo(db, g.category_id) }))
    .filter(({ g, elo }) => canLevelUp(g.difficulty, elo))
    .map(({ g, elo }) => ({
      goal_id: g.id,
      goal_title: g.title,
      category_id: g.category_id,
      difficulty: g.difficulty,
      new_difficulty: levelUpDifficulty(g.difficulty),
      category_elo: elo,
      habits: habitsOf(db, g.id).map((h) => ({ id: h.id, label: h.label, per_week: h.per_week })),
    }));
}

// A day counts for the streak with at least one task or one routine session.
function doneDates(db) {
  return db.prepare(`
    SELECT done_on AS d FROM tasks WHERE done_on IS NOT NULL
    UNION ALL SELECT day FROM habit_logs`).all().map((r) => r.d);
}

// XP = the ledger plus the bonus of every raid won (raids carry no Elo and
// no goal, so their bonus lives in the raids table).
function totalXp(db) {
  const { xp } = db.prepare(`SELECT COALESCE(SUM(delta_xp), 0) AS xp FROM progress_events`).get();
  const { bonus } = db.prepare(`SELECT COALESCE(SUM(bonus_xp), 0) AS bonus FROM raids WHERE defeated_at IS NOT NULL`).get();
  return xp + bonus;
}

function userProfile(db, today) {
  const u = db.prepare(`SELECT id, name FROM user WHERE id = 1`).get();
  const xp = totalXp(db);
  return { ...u, xp, ...level(xp), streak: streak(doneDates(db), today), gear: gearOf(db) };
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
    main_goal: main ? goalSummary(db, main, today) : null,
    level_ups: levelUps(db, today),
    raid: raidState(db, now),
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
  for (const r of db.prepare(`SELECT species, bonus_xp, defeated_at FROM raids WHERE defeated_at IS NOT NULL`).all()) {
    const d = day(localDay(new Date(r.defeated_at)));
    d.xp += r.bonus_xp;
    d.tasks.push({ label: `Raid : ${MONSTERS[r.species].name} vaincu`, goal_title: null, category_id: r.species });
  }
  const ticked = db.prepare(`
    SELECT t.done_on, t.label, g.title AS goal_title, g.category_id FROM tasks t
      JOIN steps s ON s.id = t.step_id JOIN goals g ON g.id = s.goal_id
     WHERE t.done_on IS NOT NULL ORDER BY t.done_on, s.ordre, t.ordre`).all();
  for (const t of ticked) day(t.done_on).tasks.push({ label: t.label, goal_title: t.goal_title, category_id: t.category_id });
  const sessions = db.prepare(`
    SELECT l.day, h.label, g.title AS goal_title, g.category_id FROM habit_logs l
      JOIN habits h ON h.id = l.habit_id JOIN goals g ON g.id = h.goal_id ORDER BY l.day, h.ordre`).all();
  for (const t of sessions) day(t.day).tasks.push({ label: t.label, goal_title: t.goal_title, category_id: t.category_id });
  const milestones = db.prepare(`
    SELECT s.title, s.completed_at, g.title AS goal_title, g.category_id FROM steps s JOIN goals g ON g.id = s.goal_id
     WHERE g.kind = 'routine' AND s.status = 'done'`).all();
  for (const m of milestones) {
    day(localDay(new Date(m.completed_at))).tasks.push({ label: `Jalon : ${m.title}`, goal_title: m.goal_title, category_id: m.category_id });
  }

  const dates = doneDates(db);
  return {
    today,
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
    const routine = plan.kind === 'routine';
    const goalId = db.prepare(`
      INSERT INTO goals (category_id, kind, title, prompt, difficulty, coach_intro, boss_weeks, is_main, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(plan.category, routine ? 'routine' : 'project', plan.title, prompt, plan.difficulty, plan.intro || null,
      routine ? plan.boss_weeks : null, hasMain ? 0 : 1, now.toISOString()).lastInsertRowid;

    const xp = taskXp(plan.difficulty);
    if (routine) {
      const insHabit = db.prepare(`INSERT INTO habits (goal_id, label, per_week, ordre, xp) VALUES (?, ?, ?, ?, ?)`);
      plan.habits.forEach((h, i) => insHabit.run(goalId, h.label, h.per_week, i, xp));
      // Milestones live in steps, without tasks.
      const insMilestone = db.prepare(`INSERT INTO steps (goal_id, title, ordre) VALUES (?, ?, ?)`);
      plan.milestones.forEach((m, i) => insMilestone.run(goalId, m, i));
      return goalDetail(db, goalId, now);
    }
    const insStep = db.prepare(`INSERT INTO steps (goal_id, title, ordre) VALUES (?, ?, ?)`);
    const insTask = db.prepare(`INSERT INTO tasks (step_id, label, ordre, xp) VALUES (?, ?, ?, ?)`);
    plan.steps.forEach((s, i) => {
      const stepId = insStep.run(goalId, s.title, i).lastInsertRowid;
      s.tasks.forEach((label, j) => insTask.run(stepId, label, j, xp));
    });
    return goalDetail(db, goalId, now);
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
      const done = goal.kind === 'project' && steps_total > 0 && steps_done === steps_total;
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
    return goalDetail(db, id, now);
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

const insertEvents = (db, goal, ids, events, at) => {
  const ins = db.prepare(`
    INSERT INTO progress_events (category_id, goal_id, step_id, task_id, habit_id, week, kind, delta_xp, delta_elo, elo_after, reverts_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const e of events) {
    ins.run(goal.category_id, goal.id, ids.step ?? null, null, ids.habit ?? null, ids.week ?? null,
      e.kind, e.delta_xp, e.delta_elo, e.elo_after, e.reverts_id ?? null, at);
  }
};

function routineGoal(db, goalId) {
  const goal = getGoalRow(db, goalId);
  if (goal.kind !== 'routine') throw new Conflict('not a routine');
  if (goal.status === 'archived') throw new Conflict('goal is archived');
  return goal;
}

// Tick or untick today's session of a habit. Ticking may also hold the week
// (week_bonus) and, through the run of held weeks, beat the boss; unticking
// cancels exactly what no longer holds.
export function toggleHabit(db, habitId, { now }) {
  return transaction(db, () => {
    const habit = db.prepare(`SELECT * FROM habits WHERE id = ?`).get(habitId);
    if (!habit) throw new NotFound('habit not found');
    const goal = routineGoal(db, habit.goal_id);
    const today = localDay(now);
    const week = weekStart(today);
    const at = now.toISOString();
    const elo = categoryElo(db, goal.category_id);
    const habits = habitsOf(db, goal.id);
    const counts = weekCounts(db, goal.id, week);
    const holds = (c) => habits.every((h) => (c.get(h.id) ?? 0) >= h.per_week);
    const log = db.prepare(`SELECT id FROM habit_logs WHERE habit_id = ? AND day = ?`).get(habit.id, today);
    let events;

    if (!log) {
      const k = counts.get(habit.id) ?? 0;
      const weekCompleted = !activeOf(db, goal.id, 'week_bonus', week) && holds(new Map(counts).set(habit.id, k + 1));
      const weeks = heldWeeks(db, goal.id);
      if (weekCompleted) weeks.push(week);
      const bossReached = weekCompleted && !activeOf(db, goal.id, 'boss') && weekStreak(weeks, week) >= goal.boss_weeks;
      events = sessionEvents({
        difficulty: goal.difficulty, elo, W: habits.reduce((a, h) => a + h.per_week, 0),
        k, perWeek: habit.per_week, xp: habit.xp, weekCompleted, bossReached,
      });
      db.prepare(`INSERT INTO habit_logs (habit_id, day) VALUES (?, ?)`).run(habit.id, today);
      if (bossReached) db.prepare(`UPDATE goals SET completed_at = ? WHERE id = ?`).run(at, goal.id);
    } else {
      const toRevert = [];
      const session = db.prepare(`
        SELECT e.* FROM progress_events e
         WHERE e.habit_id = ? AND e.kind = 'session' AND e.week = ? AND ${ACTIVE} ORDER BY e.id DESC`)
        .all(habit.id, week).find((e) => localDay(new Date(e.created_at)) === today);
      if (session) toRevert.push(session);
      if (!holds(new Map(counts).set(habit.id, counts.get(habit.id) - 1))) {
        const bonus = activeOf(db, goal.id, 'week_bonus', week);
        if (bonus) toRevert.push(bonus);
        const boss = activeOf(db, goal.id, 'boss', week);
        if (boss) {
          toRevert.push(boss);
          db.prepare(`UPDATE goals SET completed_at = NULL WHERE id = ?`).run(goal.id);
        }
      }
      events = revertEvents({ elo, events: toRevert });
      db.prepare(`DELETE FROM habit_logs WHERE id = ?`).run(log.id);
    }

    insertEvents(db, goal, { habit: habit.id, week }, events, at);
    return { done: !log, events };
  });
}

// Tick or untick a routine milestone (a step without tasks).
export function toggleMilestone(db, stepId, { now }) {
  return transaction(db, () => {
    const step = db.prepare(`SELECT * FROM steps WHERE id = ?`).get(stepId);
    if (!step) throw new NotFound('milestone not found');
    const goal = routineGoal(db, step.goal_id);
    const at = now.toISOString();
    const elo = categoryElo(db, goal.category_id);
    let events;
    if (step.status === 'todo') {
      events = [milestoneEvent({ difficulty: goal.difficulty, elo, xp: taskXp(goal.difficulty) })];
      db.prepare(`UPDATE steps SET status = 'done', completed_at = ? WHERE id = ?`).run(at, step.id);
    } else {
      const active = db.prepare(`SELECT e.* FROM progress_events e WHERE e.step_id = ? AND e.kind = 'milestone' AND ${ACTIVE}`).all(step.id);
      events = revertEvents({ elo, events: active });
      db.prepare(`UPDATE steps SET status = 'todo', completed_at = NULL WHERE id = ?`).run(step.id);
    }
    insertEvents(db, goal, { step: step.id }, events, at);
    return { done: step.status === 'todo', events };
  });
}

const MAX_HABIT_LABEL = 160;
const SNOOZE_DAYS = 7;

// Raise a routine by one notch (+150 difficulty): one more session a week on
// a habit, or a more demanding habit. Or snooze the offer for a week.
export function levelUpRoutine(db, goalId, { mode, habit_id: habitId, label }, { now }) {
  return transaction(db, () => {
    const goal = routineGoal(db, goalId);
    if (mode === 'snooze') {
      db.prepare(`UPDATE goals SET level_up_snoozed_until = ? WHERE id = ?`).run(addDays(localDay(now), SNOOZE_DAYS), goal.id);
      return goalDetail(db, goal.id, now);
    }
    if (mode !== 'frequency' && mode !== 'harder') throw new Conflict('mode must be frequency, harder or snooze');
    if (goal.difficulty >= DIFFICULTY_MAX) throw new Conflict('difficulty already at the maximum');
    const habit = db.prepare(`SELECT * FROM habits WHERE id = ? AND goal_id = ?`).get(Number(habitId), goal.id);
    if (!habit) throw new NotFound('habit not found');

    if (mode === 'frequency') {
      if (habit.per_week >= PER_WEEK_MAX) throw new Conflict('already every day');
      db.prepare(`UPDATE habits SET per_week = per_week + 1 WHERE id = ?`).run(habit.id);
    } else {
      const text = String(label ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_HABIT_LABEL);
      if (!text) throw new Conflict('label required');
      db.prepare(`UPDATE habits SET label = ? WHERE id = ?`).run(text, habit.id);
    }
    const difficulty = levelUpDifficulty(goal.difficulty);
    db.prepare(`UPDATE goals SET difficulty = ?, level_up_snoozed_until = NULL WHERE id = ?`).run(difficulty, goal.id);
    db.prepare(`UPDATE habits SET xp = ? WHERE goal_id = ?`).run(taskXp(difficulty), goal.id);
    return goalDetail(db, goal.id, now);
  });
}

// --- demo ------------------------------------------------------------------
// Dev-only XP grant (npm run demo:xp) to preview the level-up celebration.
// Written as an Elo-neutral 'demo' row attached to the main goal: the ledger
// stays the single source of truth and no untick can cancel it.
// Without an amount, XP lands 5 short of the next level, so the next tick
// (≥ 10 XP) levels up.
export function grantDemoXp(db, amount, { now }) {
  const goal = db.prepare(`
    SELECT * FROM goals WHERE status != 'archived' ORDER BY is_main DESC, created_at, id LIMIT 1`).get();
  if (!goal) throw new Conflict('create a goal first');
  const xp = totalXp(db);
  let delta = amount;
  if (delta === undefined) {
    delta = level(xp).level * XP_PER_LEVEL - 5 - xp;
    if (delta <= 0) delta += XP_PER_LEVEL;
  }
  if (!Number.isInteger(delta) || delta <= 0) throw new Conflict('amount must be a positive integer');
  db.prepare(`
    INSERT INTO progress_events (category_id, goal_id, kind, delta_xp, delta_elo, elo_after, created_at)
    VALUES (?, ?, 'demo', ?, 0, ?, ?)
  `).run(goal.category_id, goal.id, delta, categoryElo(db, goal.category_id), now.toISOString());
  return { granted: delta, user: userProfile(db, localDay(now)) };
}

// --- raid ------------------------------------------------------------------
// Rules in raid.js. The raid of the week is created on first read (frozen:
// species, HP, reward, bonus), charged by the week's net XP, opened on Sunday
// by the assault, then settled after every tick until the week ends.

const raidRow = (db, week) => db.prepare(`SELECT * FROM raids WHERE user_id = 1 AND week = ?`).get(week);

const ownedAccessories = (db) =>
  [...new Set(db.prepare(`SELECT reward FROM raids WHERE defeated_at IS NOT NULL ORDER BY week`).all().map((r) => r.reward))];

function gearOf(db) {
  try {
    const g = JSON.parse(db.prepare(`SELECT gear FROM user WHERE id = 1`).get()?.gear ?? '{}');
    return Object.fromEntries(SLOTS.filter((s) => ACCESSORIES[g[s]]?.slot === s).map((s) => [s, g[s]]));
  } catch {
    return {};
  }
}
const saveGear = (db, gear) => db.prepare(`UPDATE user SET gear = ? WHERE id = 1`).run(JSON.stringify(gear));

// Net XP of one game week (Monday → Sunday): the weapon's charge. Dev XP
// (npm run demo:xp) never charges it.
function weekXp(db, week) {
  const end = addDays(week, 6);
  const since = new Date(`${addDays(week, -1)}T00:00:00Z`).toISOString();
  let xp = 0;
  for (const e of db.prepare(`SELECT kind, delta_xp, created_at FROM progress_events WHERE created_at >= ?`).all(since)) {
    const d = localDay(new Date(e.created_at));
    if (d >= week && d <= end && e.kind !== 'demo') xp += e.delta_xp;
  }
  return xp;
}

// No active goal, no raid (nothing to fight with).
function ensureRaid(db, today, now) {
  const week = weekStart(today);
  const existing = raidRow(db, week);
  if (existing) return existing;
  const active = db.prepare(`SELECT * FROM goals WHERE status = 'active' ORDER BY created_at, id`).all();
  if (active.length === 0) return null;

  const species = pickSpecies({
    mainCategory: active.find((g) => g.is_main)?.category_id ?? null,
    activeCategories: active.map((g) => g.category_id),
  });
  const prev = db.prepare(`SELECT hp, defeated_at FROM raids WHERE user_id = 1 AND week < ? ORDER BY week DESC LIMIT 1`).get(week);
  const habits = db.prepare(`SELECT h.xp, h.per_week FROM habits h JOIN goals g ON g.id = h.goal_id WHERE g.status = 'active'`).all();
  const projects = active.filter((g) => g.kind === 'project').map((g) => ({ task_xp: taskXp(g.difficulty) }));
  const hp = raidHp({
    previous: prev ? { hp: prev.hp, won: prev.defeated_at != null } : null,
    lastWeekXp: weekXp(db, addDays(week, -7)),
    planned: plannedXp({ habits, projects }),
  });
  db.prepare(`
    INSERT OR IGNORE INTO raids (week, species, hp, reward, bonus_xp, created_at) VALUES (?, ?, ?, ?, ?, ?)
  `).run(week, species, hp, pickReward(species, ownedAccessories(db)), raidBonus(hp), now.toISOString());
  return raidRow(db, week);
}

function raidView(db, raid, today) {
  const charge = Math.max(0, weekXp(db, raid.week));
  const damage = raidDamage({ charge, assaultAt: raid.assault_at });
  return {
    week: raid.week,
    species: raid.species,
    name: MONSTERS[raid.species].name,
    hp: raid.hp,
    charge,
    damage,
    hp_left: Math.max(0, raid.hp - damage),
    status: raidStatus({ week: raid.week, today, assaultAt: raid.assault_at, defeatedAt: raid.defeated_at }),
    assault_day: assaultDay(raid.week),
    reward: { id: raid.reward, ...ACCESSORIES[raid.reward] },
    bonus_xp: raid.bonus_xp,
  };
}

export function raidState(db, now) {
  const today = localDay(now);
  const raid = ensureRaid(db, today, now);
  return raid ? raidView(db, raid, today) : null;
}

// Win once the assault is launched and the week's XP covers the HP; an
// untick that drops back under the HP takes the win back (bonus, reward,
// and the accessory if it was equipped and is owned no more).
function settle(db, now) {
  const raid = raidRow(db, weekStart(localDay(now)));
  if (!raid?.assault_at) return [];
  const reached = weekXp(db, raid.week) >= raid.hp;
  const info = { name: MONSTERS[raid.species].name, species: raid.species, reward: { id: raid.reward, ...ACCESSORIES[raid.reward] } };
  if (reached && !raid.defeated_at) {
    db.prepare(`UPDATE raids SET defeated_at = ? WHERE id = ?`).run(now.toISOString(), raid.id);
    return [{ kind: 'raid', delta_xp: raid.bonus_xp, delta_elo: 0, ...info }];
  }
  if (!reached && raid.defeated_at) {
    db.prepare(`UPDATE raids SET defeated_at = NULL WHERE id = ?`).run(raid.id);
    const owned = new Set(ownedAccessories(db));
    const gear = gearOf(db);
    for (const slot of SLOTS) if (gear[slot] && !owned.has(gear[slot])) delete gear[slot];
    saveGear(db, gear);
    return [{ kind: 'raid', delta_xp: -raid.bonus_xp, delta_elo: 0, ...info }];
  }
  return [];
}

export const settleRaid = (db, { now }) => transaction(db, () => settle(db, now));

// Sunday only, once: the whole charge hits at once.
export function launchAssault(db, { now }) {
  return transaction(db, () => {
    const today = localDay(now);
    const raid = ensureRaid(db, today, now);
    if (!raid) throw new Conflict('no raid this week');
    const status = raidStatus({ week: raid.week, today, assaultAt: raid.assault_at, defeatedAt: raid.defeated_at });
    if (status === 'waiting') throw new Conflict('the assault opens on Sunday');
    if (status !== 'ready') throw new Conflict('assault already launched');
    db.prepare(`UPDATE raids SET assault_at = ? WHERE id = ?`).run(now.toISOString(), raid.id);
    const events = settle(db, now);
    return { events, raid: raidView(db, raidRow(db, raid.week), today) };
  });
}

// Trophies (raids won, newest first), accessories owned, gear equipped.
export function raidCollection(db, now) {
  const week = weekStart(localDay(now));
  const trophies = db.prepare(`SELECT week, species, hp, reward, defeated_at FROM raids WHERE defeated_at IS NOT NULL ORDER BY week DESC`).all()
    .map((r) => ({ ...r, name: MONSTERS[r.species].name, reward: { id: r.reward, ...ACCESSORIES[r.reward] } }));
  const { fled } = db.prepare(`SELECT COUNT(*) AS fled FROM raids WHERE defeated_at IS NULL AND week < ?`).get(week);
  return { trophies, fled, owned: ownedAccessories(db), gear: gearOf(db) };
}

// Equip an owned accessory in its slot, or empty the slot (item null).
export function equip(db, { slot, item = null }) {
  if (!SLOTS.includes(slot)) throw new BadInput('unknown slot');
  return transaction(db, () => {
    const gear = gearOf(db);
    if (item == null) {
      delete gear[slot];
    } else {
      if (ACCESSORIES[item]?.slot !== slot) throw new BadInput('item does not fit this slot');
      if (!ownedAccessories(db).includes(item)) throw new Conflict('item not owned');
      gear[slot] = item;
    }
    saveGear(db, gear);
    return gear;
  });
}
