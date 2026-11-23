// PURE: no Firebase, no React. Slot planner (SPEC Section 10).
import {
  DAYS_PER_WEEK,
  MAX_DAYS_AHEAD,
  MAX_HOURS_PER_DAY,
  MIN_DAYS_BETWEEN_SESSIONS,
  SLOT_END_HOUR,
  SLOT_START_HOUR,
} from './config.js';
import { addDays, daysBetween, workingDaysInRange } from './dates.js';

/**
 * Remaining capacity of one item at one hour; missing data counts as 0 (never plan on unknowns).
 * @returns {number}
 */
function remainingAt(availability, equipmentId, date, hour) {
  return availability?.[equipmentId]?.[date]?.[hour] ?? 0;
}

/**
 * Candidate dates: working days from tomorrow to min(deadline, today + MAX_DAYS_AHEAD).
 * @param {string} today
 * @param {string | null} deadline
 * @returns {string[]}
 */
function candidateDates(today, deadline) {
  const horizonEnd = addDays(today, MAX_DAYS_AHEAD);
  const end = deadline && daysBetween(deadline, horizonEnd) > 0 ? deadline : horizonEnd;
  return workingDaysInRange(addDays(today, 1), end);
}

/** True if `item` fits at every hour of [start, start + sessionHours). */
function itemFits(item, date, start, sessionHours, availability) {
  for (let hour = start; hour < start + sessionHours; hour += 1) {
    if (remainingAt(availability, item.equipmentId, date, hour) < item.qty) return false;
  }
  return true;
}

/** True if the student's distinct hours that day, existing plus the block, stay within the limit. */
function withinDailyLimit(existingHours, start, sessionHours) {
  const hours = new Set(existingHours ?? []);
  for (let hour = start; hour < start + sessionHours; hour += 1) hours.add(hour);
  return hours.size <= MAX_HOURS_PER_DAY;
}

/**
 * Feasible start hours on a date (Section 10.2 step 2), in ascending order.
 * @returns {number[]}
 */
function feasibleStarts(ctx, items, date) {
  const starts = [];
  for (let start = SLOT_START_HOUR; start <= SLOT_END_HOUR - ctx.sessionHours; start += 1) {
    const fits = items.every((item) =>
      itemFits(item, date, start, ctx.sessionHours, ctx.availability),
    );
    if (fits && withinDailyLimit(ctx.userHoursByDate?.[date], start, ctx.sessionHours)) {
      starts.push(start);
    }
  }
  return starts;
}

/** Σ over items and hours of (remaining − qty): larger means more spare capacity. */
function headroom(ctx, items, date, start) {
  let total = 0;
  for (const item of items) {
    for (let hour = start; hour < start + ctx.sessionHours; hour += 1) {
      total += remainingAt(ctx.availability, item.equipmentId, date, hour) - item.qty;
    }
  }
  return total;
}

/** Start per date (step 3): preferred, then the first session's start, then most headroom. */
function chooseStart(ctx, items, date, starts, firstStart) {
  if (starts.includes(ctx.preferredStartHour)) return ctx.preferredStartHour;
  if (firstStart !== null && starts.includes(firstStart)) return firstStart;
  let best = starts[0];
  let bestHeadroom = headroom(ctx, items, date, best);
  for (const start of starts.slice(1)) {
    const value = headroom(ctx, items, date, start);
    if (value > bestHeadroom) {
      best = start;
      bestHeadroom = value;
    }
  }
  return best;
}

/** Groups feasible dates into 7-day windows counted from tomorrow. */
function feasibleDatesByWindow(ctx, items) {
  const tomorrow = addDays(ctx.today, 1);
  const windows = new Map();
  for (const date of ctx.dates) {
    const starts = feasibleStarts(ctx, items, date);
    if (starts.length === 0) continue;
    const index = Math.floor(daysBetween(tomorrow, date) / DAYS_PER_WEEK);
    if (!windows.has(index)) windows.set(index, []);
    windows.get(index).push({ date, starts });
  }
  return [...windows.keys()].sort((a, b) => a - b).map((key) => windows.get(key));
}

/** Next pick in a window: prefer ≥ MIN_DAYS_BETWEEN_SESSIONS after the last pick, else any. */
function nextPick(options, lastDate) {
  const spaced = options.find(
    (option) => !lastDate || daysBetween(lastDate, option.date) >= MIN_DAYS_BETWEEN_SESSIONS,
  );
  return spaced ?? options[0];
}

/**
 * Steps 1-5 for one fixed set of items.
 * @returns {{ date: string, startHour: number, endHour: number }[]} Sessions in date order.
 */
function selectSessions(ctx, items) {
  const sessions = [];
  let firstStart = null;
  let lastDate = null;
  for (const window of feasibleDatesByWindow(ctx, items)) {
    let options = [...window];
    let pickedInWindow = 0;
    while (options.length > 0 && pickedInWindow < ctx.maxPerWeek) {
      if (sessions.length >= ctx.totalSessions) break;
      const pick = nextPick(options, lastDate);
      options = options.filter((option) => option !== pick);
      const startHour = chooseStart(ctx, items, pick.date, pick.starts, firstStart);
      if (firstStart === null) firstStart = startHour;
      sessions.push({ date: pick.date, startHour, endHour: startHour + ctx.sessionHours });
      lastDate = pick.date;
      pickedInWindow += 1;
    }
  }
  return sessions.sort((a, b) => daysBetween(b.date, a.date));
}

/** Step 6: best single-item substitution, or null if none finds more sessions. */
function bestSubstitution(ctx, items, baseFound) {
  let best = null;
  items.forEach((item, index) => {
    for (const substitute of ctx.substitutes?.[item.equipmentId] ?? []) {
      const tried = items.map((original, i) =>
        i === index
          ? { equipmentId: substitute.equipmentId, qty: substitute.qty ?? original.qty }
          : original,
      );
      const sessions = selectSessions(ctx, tried);
      const bar = best ? best.sessions.length : baseFound;
      if (sessions.length > bar) {
        best = {
          items: tried,
          sessions,
          substitution: {
            originalEquipmentId: item.equipmentId,
            replacement: { equipmentId: substitute.equipmentId, name: substitute.name },
          },
        };
      }
    }
  });
  return best;
}

/** Step 7: the items that, on their own, block the most candidate dates. */
function findUnavailableItems(ctx, items) {
  const blocked = items.map((item) => {
    let count = 0;
    for (const date of ctx.dates) {
      let fitsSomewhere = false;
      for (let start = SLOT_START_HOUR; start <= SLOT_END_HOUR - ctx.sessionHours; start += 1) {
        if (itemFits(item, date, start, ctx.sessionHours, ctx.availability)) fitsSomewhere = true;
      }
      if (!fitsSomewhere) count += 1;
    }
    return count;
  });
  const most = Math.max(0, ...blocked);
  if (most === 0) return [];
  return items.filter((_, index) => blocked[index] === most).map((item) => item.equipmentId);
}

/**
 * Plans `totalSessions` sessions where all items are free together (SPEC Section 10.2).
 * Inputs are assumed validated (see validate.js); hours are integers, dates `YYYY-MM-DD`.
 * @param {{ items: { equipmentId: string, qty: number }[], sessionHours: number,
 *           totalSessions: number, maxPerWeek: number, deadline?: string | null, today: string,
 *           availability: Record<string, Record<string, number[]>>,
 *           userHoursByDate?: Record<string, number[]>, preferredStartHour?: number,
 *           substitutes?: Record<string, { equipmentId: string, qty?: number, name: string }[]> }} input
 * @returns {{ sessions: { date: string, startHour: number, endHour: number }[], requested: number,
 *             found: number, complete: boolean, items: { equipmentId: string, qty: number }[],
 *             substitutions: { originalEquipmentId: string, replacement: { equipmentId: string, name: string } }[],
 *             unavailableItems: string[] }}
 * @throws {AppError} INVALID_INPUT if `today` or `deadline` is not a valid date.
 */
export function planSessions(input) {
  const ctx = { ...input, dates: candidateDates(input.today, input.deadline ?? null) };
  let items = input.items.map(({ equipmentId, qty }) => ({ equipmentId, qty }));
  let sessions = selectSessions(ctx, items);
  const substitutions = [];

  if (sessions.length < ctx.totalSessions) {
    const best = bestSubstitution(ctx, items, sessions.length);
    if (best) {
      items = best.items;
      sessions = best.sessions;
      substitutions.push(best.substitution);
    }
  }

  const complete = sessions.length === ctx.totalSessions;
  return {
    sessions,
    requested: ctx.totalSessions,
    found: sessions.length,
    complete,
    items,
    substitutions,
    unavailableItems: complete ? [] : findUnavailableItems(ctx, items),
  };
}
