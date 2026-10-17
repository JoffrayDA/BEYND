// Profile tab figures, from the goal lists (active + archived) and the
// progress history.

export function profileStats({ active = [], archived = [], progress = null }) {
  const all = [...active, ...archived];
  const beaten = (g) => (g.routine ? g.routine.boss_done : g.status === 'done');
  return {
    inProgress: active.filter((g) => !beaten(g)).length,
    routines: active.filter((g) => g.routine).length,
    bosses: all.filter(beaten).length,
    bestStreak: progress?.streak.best ?? 0,
    activeDays: progress?.history.filter((d) => d.tasks.length > 0).length ?? 0,
  };
}
