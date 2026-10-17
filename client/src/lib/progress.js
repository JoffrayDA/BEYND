// Progress tab logic, pure (tested with node:test).

const DAY_MS = 86_400_000;
const toDate = (iso) => new Date(`${iso}T12:00:00Z`);
const toIso = (d) => d.toISOString().slice(0, 10);
const shift = (iso, days) => toIso(new Date(toDate(iso).getTime() + days * DAY_MS));

// Every Elo starts at 1000: anchor the curve the day before the first point,
// so even a first day of play draws a line rather than a lone dot.
export function withStart(points, start = 1000) {
  if (points.length === 0) return points;
  return [{ date: shift(points[0].date, -1), value: start }, ...points];
}

// Last `weeks` full weeks up to today, Monday first, as rows of 7 days.
// A day is "on" when at least one task ticked that day is still ticked.
export function activityWeeks(history, today, weeks = 5) {
  const on = new Set(history.filter((d) => d.tasks.length > 0).map((d) => d.date));
  const dow = (toDate(today).getUTCDay() + 6) % 7;           // 0 = Monday
  const first = shift(today, -dow - (weeks - 1) * 7);
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, i) => {
      const date = shift(first, w * 7 + i);
      return { date, on: on.has(date), future: date > today, today: date === today };
    }));
}

const dayFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

// "Aujourd'hui", "Hier", else "ven. 16 oct.".
export function fmtDay(iso, today) {
  if (iso === today) return 'Aujourd’hui';
  if (iso === shift(today, -1)) return 'Hier';
  return dayFmt.format(toDate(iso));
}

export const plural = (n, word) => `${n} ${word}${n > 1 ? 's' : ''}`;
