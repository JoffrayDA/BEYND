// Home screen logic, pure (tested with node:test).

const fr1 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
const fr0 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

// Elo is shown as a whole number; small gains keep their decimal so a
// +0,4 tick never reads as +0.
export const fmtElo = (v) => fr0.format(Math.round(v));

export function fmtGain(v) {
  const sign = v > 0 ? '+' : v < 0 ? '−' : '±';
  const a = Math.abs(v);
  return `${sign}${a < 10 ? fr1.format(a) : fr0.format(Math.round(a))}`;
}

// What to celebrate after a toggle, most important first. `events` are the
// rows the server wrote; `before`/`after` are user profiles.
export function celebrationFor({ events, before, after, goalTitle, stepTitle }) {
  const sum = (kind) => events.filter((e) => e.kind === kind).reduce((a, e) => a + e.delta_elo, 0);
  const elo = events.reduce((a, e) => a + e.delta_elo, 0);
  const xp = events.reduce((a, e) => a + e.delta_xp, 0);
  const levelUp = after.level > before.level ? after.level : null;

  if (events.some((e) => e.kind === 'boss' && e.delta_elo > 0)) {
    // The boss tick also closes the last step: both bonuses count.
    return { kind: 'boss', title: 'Boss vaincu', subtitle: goalTitle, elo, xp, bonus: sum('step_bonus') + sum('boss'), levelUp };
  }
  if (events.some((e) => e.kind === 'step_bonus' && e.delta_elo > 0)) {
    return { kind: 'step', title: 'Étape franchie', subtitle: stepTitle, elo, xp, bonus: sum('step_bonus'), levelUp };
  }
  // Routines: a held week, or a milestone reached.
  if (events.some((e) => e.kind === 'week_bonus' && e.delta_elo > 0)) {
    return { kind: 'step', title: 'Semaine tenue', subtitle: goalTitle, elo, xp, bonus: sum('week_bonus'), levelUp };
  }
  if (events.some((e) => e.kind === 'milestone' && e.delta_elo > 0)) {
    return { kind: 'step', title: 'Jalon atteint', subtitle: stepTitle, elo, xp, bonus: sum('milestone'), levelUp };
  }
  if (levelUp) return { kind: 'level', title: `Niveau ${levelUp}`, subtitle: null, elo, xp, bonus: 0, levelUp };
  // A plain tick or an untick: a short toast is enough.
  return { kind: 'toast', elo, xp };
}

// Avatar tunic colour grows with the level.
export function avatarTier(level) {
  if (level >= 20) return 'elite';
  if (level >= 10) return 'dur';
  if (level >= 5) return 'facile';
  return 'moyen';
}
