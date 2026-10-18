// Sunday raid, client side: what the Home card says and shows, and the
// Profile's equipment. Pure (tested with node:test). Rules: server/raid.js.
import { ACCESSORIES, SLOTS, SLOT_LABELS } from '../../../server/raid.js';
import { addDays } from '../../../server/engine.js';

const pct = (a, b) => (b > 0 ? Math.max(0, Math.min(100, Math.round((a / b) * 100))) : 0);

function daysBetween(from, to) {
  let n = 0;
  for (let d = from; d < to && n < 7; d = addDays(d, 1)) n += 1;
  return n;
}

// `raid` from /api/state, `today` = state.today (game day).
export function raidCard(raid, today) {
  const { status, hp, hp_left: left, charge, reward } = raid;
  const base = {
    hpPct: pct(left, hp),
    chargePct: pct(charge, hp),
    canAssault: status === 'ready',
    showCharge: status === 'waiting' || status === 'ready',
  };
  if (status === 'waiting') {
    const n = daysBetween(today, raid.assault_day);
    return {
      ...base,
      label: n === 1 ? 'Combat demain' : `Combat dans ${n} jours`,
      line: 'Il est intouchable avant dimanche. Chaque coche charge ton arme.',
    };
  }
  if (status === 'ready') {
    return {
      ...base,
      label: 'Jour du raid',
      line: charge >= hp
        ? 'Ton arme est assez chargée pour l’achever d’un coup.'
        : `Ton arme fera ${charge} dégâts. Il lui restera ${hp - charge} PV à finir avec tes coches d’aujourd’hui.`,
    };
  }
  if (status === 'fighting') {
    return {
      ...base,
      label: 'Combat en cours',
      line: `Il lui reste ${left} PV. Chaque coche le frappe, jusqu’à lundi 4 h.`,
    };
  }
  if (status === 'won') {
    return { ...base, label: 'Vaincu', line: `Trophée gagné, et ${reward.name.toLowerCase()} pour ton personnage.` };
  }
  return { ...base, label: 'Enfui', line: 'Il s’est enfui. Le prochain sera un peu plus faible.' };
}

// Owned accessories grouped by slot, in slot order, for the Profile.
export function gearSlots(owned = [], gear = {}) {
  return SLOTS.map((slot) => ({
    slot,
    label: SLOT_LABELS[slot],
    equipped: gear[slot] ?? null,
    items: owned.filter((id) => ACCESSORIES[id]?.slot === slot).map((id) => ({ id, name: ACCESSORIES[id].name })),
  })).filter((s) => s.items.length > 0);
}
