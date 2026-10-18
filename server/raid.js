// Sunday raid rules — pure, no DB (the client imports this module too).
// See docs/ARCHITECTURE.md § Raid du dimanche.
//
// One monster per week. Monday to Saturday it cannot be hit: every tick
// charges the weapon (charge = net XP of the week). On Sunday the player
// launches the assault, which deals the whole charge at once; after that,
// Sunday's ticks keep hitting until the game week ends (Monday 4 h).
// A win gives bonus XP, a trophy and an accessory. Never any Elo.

import { addDays } from './engine.js';

export const RAID_MIN_HP = 50;
export const RAID_MAX_HP = 5000;
export const RAID_HP_SHARE = 0.75;     // first raid: 75 % of the reference XP
export const RAID_WIN_STEP = 1.1;      // next monster after a win
export const RAID_LOSS_STEP = 0.9;     // … after a loss
export const RAID_BONUS_SHARE = 0.2;   // bonus XP = 20 % of the HP
export const PLANNED_TASKS_PER_PROJECT = 5;

// One species per category: the main goal picks the week's monster.
export const MONSTERS = {
  tech: { name: 'Golem de code', loot: ['casque', 'baton', 'bouclier'] },
  langues: { name: 'Spectre bavard', loot: ['grimoire', 'couronne', 'cape'] },
  sport: { name: 'Troll des cavernes', loot: ['epee', 'bandeau', 'bouclier'] },
  carriere: { name: 'Dragon de bureau', loot: ['couronne', 'cape', 'epee'] },
  creatif: { name: 'Chimère d’encre', loot: ['baton', 'grimoire', 'bandeau'] },
  autre: { name: 'Slime glouton', loot: ['bandeau', 'casque', 'grimoire'] },
};

// Equipment slots on the avatar, and the accessories that fill them.
export const SLOTS = ['head', 'back', 'hand', 'offhand'];
export const SLOT_LABELS = { head: 'Tête', back: 'Dos', hand: 'Main', offhand: 'Autre main' };
export const ACCESSORIES = {
  casque: { name: 'Casque de fer', slot: 'head' },
  couronne: { name: 'Couronne', slot: 'head' },
  bandeau: { name: 'Bandeau rouge', slot: 'head' },
  cape: { name: 'Cape de héros', slot: 'back' },
  epee: { name: 'Épée', slot: 'hand' },
  baton: { name: 'Bâton de mage', slot: 'hand' },
  bouclier: { name: 'Bouclier', slot: 'offhand' },
  grimoire: { name: 'Grimoire', slot: 'offhand' },
};

const round5 = (x) => Math.round(x / 5) * 5;
const clampHp = (x) => Math.min(RAID_MAX_HP, Math.max(RAID_MIN_HP, round5(x)));

// XP a week of the current plan should bring: every routine session at its
// weekly target, plus a few tasks per active project.
export function plannedXp({ habits = [], projects = [] }) {
  return habits.reduce((a, h) => a + h.xp * h.per_week, 0)
    + projects.reduce((a, p) => a + p.task_xp * PLANNED_TASKS_PER_PROJECT, 0);
}

// The monster adapts to the player: ±10 % from the previous one, or for the
// very first raid 75 % of last week's XP (of the plan when last week is empty).
export function raidHp({ previous = null, lastWeekXp = 0, planned = 0 }) {
  if (previous) return clampHp(previous.hp * (previous.won ? RAID_WIN_STEP : RAID_LOSS_STEP));
  return clampHp(RAID_HP_SHARE * (lastWeekXp > 0 ? lastWeekXp : planned));
}

export const raidBonus = (hp) => Math.round(hp * RAID_BONUS_SHARE);

// The species' loot not owned yet, else any accessory not owned yet, else
// the species' first item again (the trophy is then the only new thing).
export function pickReward(species, owned = []) {
  const have = new Set(owned);
  const loot = MONSTERS[species].loot;
  return loot.find((id) => !have.has(id))
    ?? Object.keys(ACCESSORIES).find((id) => !have.has(id))
    ?? loot[0];
}

// The species of the week: the main goal's category, else the category with
// the most active goals, else the slime.
export function pickSpecies({ mainCategory = null, activeCategories = [] }) {
  if (mainCategory) return mainCategory;
  const count = new Map();
  for (const c of activeCategories) count.set(c, (count.get(c) ?? 0) + 1);
  return [...count].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'autre';
}

export const assaultDay = (week) => addDays(week, 6);

// waiting (Mon–Sat) → ready (Sunday) → fighting (assault launched) → won;
// a week that ends without a win is 'fled'.
export function raidStatus({ week, today, assaultAt, defeatedAt }) {
  if (defeatedAt) return 'won';
  if (today > assaultDay(week)) return 'fled';
  if (assaultAt) return 'fighting';
  return today === assaultDay(week) ? 'ready' : 'waiting';
}

// Damage dealt so far: nothing before the assault, then the whole charge.
export const raidDamage = ({ charge, assaultAt }) => (assaultAt ? Math.max(0, charge) : 0);
