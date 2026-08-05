/* ══════════════════════════════════════════════════════════════
   Planner — habits, goals, and an honest record of what happened.

   Principles this file enforces, because they are easy to lose:
   · Kaizen. Something small every day beats something big rarely.
     Every habit has a floor — the tiniest version that still counts.
   · No backlog. A missed day is gone. It never becomes work owed.
   · No scheduling. Nothing here knows or asks what time it is.
   · Plain numbers. Facts, not verdicts.

   Pure logic — no DOM, no storage.
   ══════════════════════════════════════════════════════════════ */

export const CADENCE = {
  daily:  { id: 'daily',  label: 'Every day',      perWeek: 7 },
  five:   { id: 'five',   label: '5 days a week',  perWeek: 5 },
  four:   { id: 'four',   label: '4 days a week',  perWeek: 4 },
  three:  { id: 'three',  label: '3 days a week',  perWeek: 3 },
  two:    { id: 'two',    label: '2 days a week',  perWeek: 2 },
  weekly: { id: 'weekly', label: 'Once a week',    perWeek: 1 },
};

export const perWeekOf = (habit) => (CADENCE[habit.cadence] || CADENCE.daily).perWeek;

/* ── dates ─────────────────────────────────────────────────────
   Local dates only. A day is what the calendar on your wall says. */
export const dayKey = (d = new Date()) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};
export const keyToDate = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (key, n) => { const d = keyToDate(key); d.setDate(d.getDate() + n); return dayKey(d); };
export const daysBetween = (a, b) => Math.round((keyToDate(b) - keyToDate(a)) / 86400000);

/* Weeks run Monday to Sunday. */
export function weekStart(key) {
  const d = keyToDate(key);
  const shift = (d.getDay() + 6) % 7;      // Sunday(0) → 6
  d.setDate(d.getDate() - shift);
  return dayKey(d);
}
export const daysLeftInWeek = (key) => 7 - daysBetween(weekStart(key), key);   // includes today

/* ── the log ───────────────────────────────────────────────────
   log = { 'habitId': { 'YYYY-MM-DD': true } }  — append only. */
export const didOn = (log, habitId, key) => !!(log[habitId] && log[habitId][key]);

export function doneThisWeek(log, habitId, today = dayKey()) {
  const start = weekStart(today);
  let n = 0;
  for (let i = 0; i < 7; i++) {
    const k = addDays(start, i);
    if (daysBetween(k, today) < 0) break;   // don't count the future
    if (didOn(log, habitId, k)) n++;
  }
  return n;
}

/* ── what today actually asks of you ───────────────────────────
   A daily habit asks every day. A weekly one stays quiet until the
   maths runs out — flexible right up until flexibility becomes
   avoidance. */
export function requiredToday(habit, log, today = dayKey()) {
  if (didOn(log, habit.id, today)) return false;
  const target = perWeekOf(habit);
  if (target >= 7) return true;
  const owed = target - doneThisWeek(log, habit.id, today);
  if (owed <= 0) return false;
  return owed >= daysLeftInWeek(today);
}

/* Offered but not demanded: on the list, no pressure. */
export function availableToday(habit, log, today = dayKey()) {
  if (didOn(log, habit.id, today)) return false;
  return doneThisWeek(log, habit.id, today) < perWeekOf(habit);
}

/* ── the gate ──────────────────────────────────────────────────
   Only habits you flagged hold it, and only when today asks. */
export function gateBlockers(habits, log, today = dayKey()) {
  return habits.filter((h) => !h.archived && h.gate && requiredToday(h, log, today));
}
export const gateOpen = (habits, log, today = dayKey()) => gateBlockers(habits, log, today).length === 0;

/* ── the honest record ─────────────────────────────────────────
   Counts, never verdicts. */
export function stats(habit, log, today = dayKey(), window = 30) {
  const days = [];
  for (let i = window - 1; i >= 0; i--) days.push(addDays(today, -i));
  const done = days.filter((k) => didOn(log, habit.id, k)).length;

  const since = habit.created ? habit.created.slice(0, 10) : days[0];
  const span = Math.max(1, daysBetween(since, today) + 1);
  const expected = Math.max(1, Math.round((Math.min(span, window) / 7) * perWeekOf(habit)));

  /* current run: consecutive days back from today (or yesterday, so a day
     still in progress does not read as broken) */
  let streak = 0;
  let cursor = didOn(log, habit.id, today) ? today : addDays(today, -1);
  while (didOn(log, habit.id, cursor)) { streak++; cursor = addDays(cursor, -1); }

  let best = 0, run = 0;
  const first = since < days[0] ? since : days[0];
  for (let k = first; daysBetween(k, today) >= 0; k = addDays(k, 1)) {
    if (didOn(log, habit.id, k)) { run++; best = Math.max(best, run); } else run = 0;
  }

  return {
    window, done, expected,
    thisWeek: doneThisWeek(log, habit.id, today),
    target: perWeekOf(habit),
    streak, best,
    days: days.map((k) => ({ key: k, done: didOn(log, habit.id, k) })),
  };
}

/* ── goals ─────────────────────────────────────────────────────
   Countable goals get arithmetic. Open-ended ones get a count of
   sessions and no invented percentage. */
export function goalProgress(goal, habits, log, today = dayKey()) {
  const mine = habits.filter((h) => h.goalId === goal.id && !h.archived);
  const sessions = mine.reduce((n, h) => n + Object.keys(log[h.id] || {}).length, 0);

  if (!goal.targetDate || !goal.total || !goal.unit) {
    return { kind: 'open', sessions, habits: mine.length };
  }

  const done = Number(goal.done) || 0;
  const remaining = Math.max(0, goal.total - done);
  const daysLeft = Math.max(0, daysBetween(today, goal.targetDate));
  const needPerDay = daysLeft > 0 ? Math.ceil(remaining / daysLeft) : remaining;

  /* actual pace over the last 30 days of logged sessions */
  const recent = mine.reduce((n, h) => n + stats(h, log, today).done, 0);
  const perDay = recent / 30;
  const projectedDays = perDay > 0 ? Math.ceil(remaining / (perDay * (goal.perSession || 1))) : null;

  return {
    kind: 'counted',
    done, total: goal.total, unit: goal.unit, remaining,
    daysLeft, needPerDay,
    onPaceDate: projectedDays === null ? null : addDays(today, projectedDays),
    lateBy: projectedDays === null ? null : daysBetween(goal.targetDate, addDays(today, projectedDays)),
    sessions,
  };
}
