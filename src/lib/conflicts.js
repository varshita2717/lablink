// PURE: no Firebase, no React. Conflict engine (SPEC Section 11).
import {
  FAIRNESS_CAP_HOURS,
  STAGE_WEIGHTS,
  URGENCY_WINDOW_DAYS,
  W_FAIRNESS,
  W_STAGE,
  W_URGENCY,
} from './config.js';
import { daysBetween } from './dates.js';
import { planSessions } from './planner.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const demandKey = (equipmentId, date, hour) => `${equipmentId}|${date}|${hour}`;

/** Calls `visit(equipmentId, date, hour, qty)` for every hour a request occupies. */
function forEachHour(request, visit) {
  for (const session of request.sessions) {
    for (const item of request.items) {
      for (let hour = session.startHour; hour < session.endHour; hour += 1) {
        visit(item.equipmentId, session.date, hour, item.qty);
      }
    }
  }
}

/**
 * Counts distinct (date, hour) pairs over confirmed bookings between two dates (inclusive).
 * @param {{ date: string, startHour: number, endHour: number, status: string }[]} bookings
 * @param {string} fromDate
 * @param {string} toDate
 * @returns {number}
 */
export function countDistinctHours(bookings, fromDate, toDate) {
  const hours = new Set();
  for (const booking of bookings) {
    if (booking.status !== 'confirmed') continue;
    if (daysBetween(fromDate, booking.date) < 0 || daysBetween(booking.date, toDate) < 0) continue;
    for (let hour = booking.startHour; hour < booking.endHour; hour += 1) {
      hours.add(`${booking.date}|${hour}`);
    }
  }
  return hours.size;
}

/**
 * Scores a request (Section 11.2). Values are unrounded.
 * @param {{ deadline: string, stage: string }} request
 * @param {number} hoursUsed30d Distinct hours the student used in the last 30 days.
 * @param {string} today `YYYY-MM-DD`.
 * @returns {{ urgency: number, fairness: number, stage: number, total: number }}
 * @throws {AppError} INVALID_INPUT if a date is malformed.
 */
export function scoreRequest(request, hoursUsed30d, today) {
  const daysToDeadline = Math.max(0, daysBetween(today, request.deadline));
  const urgency = clamp(1 - daysToDeadline / URGENCY_WINDOW_DAYS, 0, 1);
  const fairness = 1 - Math.min(hoursUsed30d / FAIRNESS_CAP_HOURS, 1);
  const stage = STAGE_WEIGHTS[request.stage] ?? 0;
  const total = W_URGENCY * urgency + W_FAIRNESS * fairness + W_STAGE * stage;
  return { urgency, fairness, stage, total };
}

/**
 * Finds groups of pending requests competing for over-demanded hours (Section 11.1).
 * Missing availability falls back to the equipment's full quantity.
 * @param {{ id: string, items: object[], sessions: object[] }[]} pendingRequests
 * @param {Record<string, { quantity: number }>} equipmentById
 * @param {Record<string, Record<string, number[]>>} availability
 * @returns {{ requestIds: string[], conflictedKeys: string[] }[]} Groups of two or more requests.
 */
export function findConflictGroups(pendingRequests, equipmentById, availability) {
  const demand = new Map();
  const requestsByKey = new Map();
  for (const request of pendingRequests) {
    forEachHour(request, (equipmentId, date, hour, qty) => {
      const key = demandKey(equipmentId, date, hour);
      demand.set(key, (demand.get(key) ?? 0) + qty);
      if (!requestsByKey.has(key)) requestsByKey.set(key, new Set());
      requestsByKey.get(key).add(request.id);
    });
  }

  const parent = new Map(pendingRequests.map((r) => [r.id, r.id]));
  const find = (id) => (parent.get(id) === id ? id : find(parent.get(id)));
  const conflictedKeys = [];
  for (const [key, total] of demand) {
    const [equipmentId, date, hour] = key.split('|');
    const remaining =
      availability?.[equipmentId]?.[date]?.[Number(hour)] ??
      equipmentById[equipmentId]?.quantity ??
      0;
    if (total <= remaining) continue;
    conflictedKeys.push(key);
    const [first, ...rest] = requestsByKey.get(key);
    for (const id of rest) parent.set(find(id), find(first));
  }

  const groups = new Map();
  for (const key of conflictedKeys) {
    const root = find([...requestsByKey.get(key)][0]);
    if (!groups.has(root)) groups.set(root, { requestIds: new Set(), conflictedKeys: [] });
    const group = groups.get(root);
    requestsByKey.get(key).forEach((id) => group.requestIds.add(id));
    group.conflictedKeys.push(key);
  }
  const order = new Map(pendingRequests.map((r, i) => [r.id, i]));
  return [...groups.values()]
    .filter((group) => group.requestIds.size > 1)
    .map((group) => ({
      requestIds: [...group.requestIds].sort((a, b) => order.get(a) - order.get(b)),
      conflictedKeys: group.conflictedKeys.sort(),
    }));
}

/** Copies the availability rows a set of requests touches. */
function copyCapacity(availability, requests) {
  const copy = {};
  for (const request of requests) {
    for (const item of request.items) {
      if (copy[item.equipmentId]) continue;
      copy[item.equipmentId] = Object.fromEntries(
        Object.entries(availability?.[item.equipmentId] ?? {}).map(([date, hours]) => [
          date,
          [...hours],
        ]),
      );
    }
  }
  return copy;
}

/** True if every item fits in every hour of every session (all-or-nothing). */
function fitsAll(request, capacity) {
  let fits = true;
  forEachHour(request, (equipmentId, date, hour, qty) => {
    if ((capacity[equipmentId]?.[date]?.[hour] ?? 0) < qty) fits = false;
  });
  return fits;
}

/** Re-plans a losing request against the capacity left after the winners (Section 11.3 step 3). */
function planAlternatives(request, capacity, context) {
  const first = request.sessions[0];
  const plan = planSessions({
    items: request.items.map(({ equipmentId, qty }) => ({ equipmentId, qty })),
    sessionHours: first.endHour - first.startHour,
    totalSessions: request.sessions.length,
    maxPerWeek: request.sessions.length,
    deadline: request.deadline,
    today: context.today,
    availability: capacity,
    userHoursByDate: context.userHoursByStudent?.[request.studentUid] ?? {},
    substitutes: context.substitutes,
  });
  return { sessions: plan.sessions, substitutions: plan.substitutions, complete: plan.complete };
}

/**
 * Ranks a conflict group and allocates all-or-nothing by score (Section 11.3).
 * @param {{ requests: object[], availability: Record<string, Record<string, number[]>>,
 *           hoursUsed30dByStudent: Record<string, number>,
 *           userHoursByStudent?: Record<string, Record<string, number[]>>,
 *           substitutes?: Record<string, object[]>, today: string }} input
 *   Each request has `id`, `studentUid`, `studentName`, `projectTitle`, `items`, `sessions`,
 *   `deadline`, `stage` and a numeric `createdAt` (milliseconds) for the tie-break.
 * @returns {{ ranking: object[] }} Entries ordered by rank; losers carry `alternatives`.
 * @throws {AppError} INVALID_INPUT if a date is malformed.
 */
export function resolveGroup({
  requests,
  availability,
  hoursUsed30dByStudent,
  userHoursByStudent,
  substitutes,
  today,
}) {
  const scored = requests
    .map((request) => ({
      request,
      score: scoreRequest(request, hoursUsed30dByStudent?.[request.studentUid] ?? 0, today),
    }))
    .sort((a, b) => b.score.total - a.score.total || a.request.createdAt - b.request.createdAt);

  const capacity = copyCapacity(availability, requests);
  const winners = new Set();
  for (const { request } of scored) {
    if (!fitsAll(request, capacity)) continue;
    winners.add(request.id);
    forEachHour(request, (equipmentId, date, hour, qty) => {
      capacity[equipmentId][date][hour] -= qty;
    });
  }

  const context = { today, userHoursByStudent, substitutes };
  return {
    ranking: scored.map(({ request, score }, index) => ({
      requestId: request.id,
      studentUid: request.studentUid,
      studentName: request.studentName,
      projectTitle: request.projectTitle,
      deadline: request.deadline,
      stage: request.stage,
      score,
      rank: index + 1,
      isWinner: winners.has(request.id),
      alternatives: winners.has(request.id) ? null : planAlternatives(request, capacity, context),
    })),
  };
}
