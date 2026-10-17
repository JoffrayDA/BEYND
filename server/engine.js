// Game rules — pure functions, no DB, no I/O. See docs/ARCHITECTURE.md §3.
// The DB layer persists what these return as progress_events rows; every
// derived number (Elo, XP, level, streak) is recomputed from those rows.

export const START_ELO = 1000;
export const DIFFICULTY_MIN = 400;
export const DIFFICULTY_MAX = 2200;
export const XP_PER_LEVEL = 1000;

// Plan size limits (coach output and user edits alike).
export const MAX_STEPS = 8;
export const MAX_TASKS = 10;

// Ordered by upper bound; the last tier has no ceiling.
export const TIERS = [
  { id: 'facile', label: 'Facile', below: 800, xp: 10 },
  { id: 'moyen', label: 'Moyen', below: 1400, xp: 20 },
  { id: 'dur', label: 'Dur', below: 1800, xp: 35 },
  { id: 'elite', label: 'Élite', below: Infinity, xp: 50 },
];

// Elo is stored with one decimal so a small gain split across many tasks
// never rounds down to zero.
export const round1 = (x) => Math.round(x * 10) / 10;

export const clampDifficulty = (d) =>
  Math.min(DIFFICULTY_MAX, Math.max(DIFFICULTY_MIN, Math.round(d)));

// Brief §4: a goal above your level pays more, a trivial one pays the floor.
export function gain(difficulty, elo) {
  return Math.max(2, Math.round((difficulty - elo) / 10 + 20));
}

export function tier(difficulty) {
  return TIERS.find((t) => difficulty < t.below);
}

export const taskXp = (difficulty) => tier(difficulty).xp;

export function level(xp) {
  return {
    level: Math.floor(xp / XP_PER_LEVEL) + 1,
    xpInLevel: xp % XP_PER_LEVEL,
    xpForNext: XP_PER_LEVEL,
  };
}

// Events produced by ticking one task, in the order they must be stored.
// Each gain is recomputed from the Elo reached by the previous event, so the
// step bonus and the boss use "the Elo of the moment".
export function checkEvents({ difficulty, elo, taskCount, xp, stepCompleted = false, goalCompleted = false }) {
  if (!(taskCount >= 1)) throw new Error('taskCount must be >= 1');
  if (goalCompleted && !stepCompleted) throw new Error('goal cannot complete without its step');

  const events = [];
  let current = elo;
  const push = (kind, deltaXp, deltaElo) => {
    current = round1(current + deltaElo);
    events.push({ kind, delta_xp: deltaXp, delta_elo: deltaElo, elo_after: current });
  };

  push('task', xp, round1(gain(difficulty, current) / taskCount));
  if (stepCompleted) push('step_bonus', 0, gain(difficulty, current));
  if (goalCompleted) push('boss', 0, gain(difficulty, current) * 2);
  return events;
}

const REVERT_ORDER = { boss: 0, step_bonus: 1, task: 2 };

// Unticking stores the exact opposite of what was granted — never a
// recomputation — so check + uncheck always lands back on the same Elo.
// `events` are the still-active rows to cancel (they must carry their id).
export function revertEvents({ elo, events }) {
  let current = elo;
  return [...events]
    .sort((a, b) => REVERT_ORDER[a.kind] - REVERT_ORDER[b.kind])
    .map((e) => {
      current = round1(current - e.delta_elo);
      return {
        kind: e.kind,
        delta_xp: -e.delta_xp,
        delta_elo: -e.delta_elo,
        elo_after: current,
        reverts_id: e.id,
      };
    });
}

// Events that have not been cancelled, and are not themselves cancellations.
export function activeEvents(events) {
  const reverted = new Set(events.filter((e) => e.reverts_id != null).map((e) => e.reverts_id));
  return events.filter((e) => e.reverts_id == null && !reverted.has(e.id));
}

export function categoryElo(events, categoryId) {
  const sum = events
    .filter((e) => e.category_id === categoryId)
    .reduce((acc, e) => acc + e.delta_elo, 0);
  return round1(START_ELO + sum);
}

export const totalXp = (events) => events.reduce((acc, e) => acc + e.delta_xp, 0);

// Mean of the categories that hold at least one non-archived goal.
export function lifeElo(elos) {
  if (elos.length === 0) return START_ELO;
  return round1(elos.reduce((a, b) => a + b, 0) / elos.length);
}

const DAY_MS = 86400000;
const dayNumber = (iso) => Math.floor(Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) / DAY_MS);

// Consecutive days with at least one task done, ending today or yesterday
// (a streak isn't broken until a full day has passed without a tick).
export function streak(doneDates, today) {
  const days = new Set(doneDates.map(dayNumber));
  let d = dayNumber(today);
  if (!days.has(d)) d -= 1;
  let count = 0;
  while (days.has(d)) { count += 1; d -= 1; }
  return count;
}

// Longest run of consecutive days ever, for the Progress screen.
export function bestStreak(doneDates) {
  const days = [...new Set(doneDates.map(dayNumber))].sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  days.forEach((d, i) => {
    run = i > 0 && d === days[i - 1] + 1 ? run + 1 : 1;
    best = Math.max(best, run);
  });
  return best;
}
