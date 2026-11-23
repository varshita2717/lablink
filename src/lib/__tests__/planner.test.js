import { describe, expect, it, vi } from 'vitest';
import { planSessions } from '../planner.js';
import { addDays, daysBetween, horizonDates, isWorkingDay } from '../dates.js';
import { buildAvailability } from '../booking.js';
import { buildSeedData } from '../seed.js';

vi.mock('../firebase.js', () => ({ db: {} }));
vi.mock('../inventory.js', () => ({ invalidateInventory: () => {} }));

const TODAY = '2026-11-23'; // Monday
const DATES = horizonDates(TODAY);

/** availability with every item at its full quantity, then per-cell overrides. */
function freeAvailability(quantities, overrides = {}) {
  const availability = buildAvailability(
    Object.entries(quantities).map(([id, quantity]) => ({ id, quantity })),
    DATES,
    [],
  );
  for (const [key, remaining] of Object.entries(overrides)) {
    const [id, date, hour] = key.split('|');
    availability[id][date][Number(hour)] = remaining;
  }
  return availability;
}

const base = (overrides) => ({
  items: [
    { equipmentId: 'a', qty: 1 },
    { equipmentId: 'b', qty: 1 },
  ],
  sessionHours: 3,
  totalSessions: 2,
  maxPerWeek: 2,
  deadline: null,
  today: TODAY,
  availability: freeAvailability({ a: 2, b: 2 }),
  userHoursByDate: {},
  ...overrides,
});

describe('planSessions', () => {
  it('finds 2 sessions in one week with all items free, at least 2 days apart', () => {
    const plan = planSessions(base());
    expect(plan.complete).toBe(true);
    expect(plan.found).toBe(2);
    expect(plan.requested).toBe(2);
    const [first, second] = plan.sessions;
    expect(daysBetween(first.date, second.date)).toBeGreaterThanOrEqual(2);
    expect(daysBetween(addDays(TODAY, 1), second.date)).toBeLessThan(7);
    expect(first.endHour - first.startHour).toBe(3);
    expect(second.startHour).toBe(first.startHour); // reuses the first session's start
    expect(plan.substitutions).toEqual([]);
    expect(plan.unavailableItems).toEqual([]);
  });

  it('respects the deadline', () => {
    const plan = planSessions(base({ totalSessions: 4, maxPerWeek: 5, deadline: '2026-11-25' }));
    expect(plan.sessions.map((s) => s.date)).toEqual(['2026-11-24', '2026-11-25']);
    expect(plan.complete).toBe(false);
  });

  it('returns nothing when the deadline has already passed', () => {
    const plan = planSessions(base({ deadline: TODAY }));
    expect(plan.found).toBe(0);
    expect(plan.unavailableItems).toEqual([]);
  });

  it('respects the 14-day horizon and skips weekends', () => {
    const plan = planSessions(base({ totalSessions: 20, maxPerWeek: 5 }));
    expect(plan.found).toBe(10);
    for (const session of plan.sessions) {
      expect(isWorkingDay(session.date)).toBe(true);
      expect(daysBetween(TODAY, session.date)).toBeGreaterThanOrEqual(1);
      expect(daysBetween(TODAY, session.date)).toBeLessThanOrEqual(14);
    }
  });

  it('respects remaining capacity: a fully booked 250 mL flask is replaced by the 500 mL flask (seed data)', () => {
    const seed = buildSeedData(TODAY);
    const equipment = seed.equipment;
    const byId = Object.fromEntries(equipment.map((item) => [item.id, item]));
    const availability = buildAvailability(equipment, DATES, seed.slots);
    const acid = seed.experiments.find((exp) => exp.id === 'exp-acid-heating');
    const plan = planSessions({
      items: acid.requiredEquipment.map(({ equipmentId, qty }) => ({ equipmentId, qty })),
      sessionHours: 3,
      totalSessions: 4,
      maxPerWeek: 2,
      deadline: addDays(TODAY, 12),
      today: TODAY,
      availability,
      userHoursByDate: {},
      substitutes: {
        'eq-flask-250': [{ equipmentId: 'eq-flask-500', qty: 1, name: byId['eq-flask-500'].name }],
      },
    });
    expect(plan.complete).toBe(true);
    expect(plan.found).toBe(4);
    expect(plan.substitutions).toEqual([
      {
        originalEquipmentId: 'eq-flask-250',
        replacement: { equipmentId: 'eq-flask-500', name: 'Round-bottom flask 500 mL' },
      },
    ]);
    expect(plan.items.map((item) => item.equipmentId)).toContain('eq-flask-500');
    expect(plan.items.map((item) => item.equipmentId)).not.toContain('eq-flask-250');
    // Two per 7-day window, spread out.
    const [s1, s2, s3, s4] = plan.sessions;
    expect(daysBetween(s1.date, s2.date)).toBeGreaterThanOrEqual(2);
    expect(daysBetween(s3.date, s4.date)).toBeGreaterThanOrEqual(2);
  });

  it('keeps the original items when no substitute does better', () => {
    const plan = planSessions(
      base({
        totalSessions: 20,
        maxPerWeek: 5,
        availability: freeAvailability({ a: 2, b: 2, c: 0 }),
        substitutes: { a: [{ equipmentId: 'c', qty: 1, name: 'C' }] },
      }),
    );
    expect(plan.substitutions).toEqual([]);
    expect(plan.items.map((item) => item.equipmentId)).toEqual(['a', 'b']);
  });

  it('respects MAX_HOURS_PER_DAY with the student’s existing bookings', () => {
    // 9, 10, 15 and 16 already booked: every 3-hour block makes at least 5 distinct hours.
    const plan = planSessions(base({ userHoursByDate: { '2026-11-24': [9, 10, 15, 16] } }));
    expect(plan.sessions[0].date).not.toBe('2026-11-24');
    // One existing hour inside the block still fits: {9,10,11} is 3 distinct hours.
    const overlap = planSessions(
      base({ userHoursByDate: { '2026-11-24': [9] }, preferredStartHour: 9 }),
    );
    expect(overlap.sessions[0]).toEqual({ date: '2026-11-24', startHour: 9, endHour: 12 });
  });

  it('uses preferredStartHour when feasible, and falls back when it is not', () => {
    const plan = planSessions(base({ sessionHours: 2, preferredStartHour: 14 }));
    expect(plan.sessions.every((s) => s.startHour === 14)).toBe(true);
    const tooLate = planSessions(base({ sessionHours: 3, preferredStartHour: 15 }));
    expect(tooLate.sessions[0].startHour).toBe(9);
  });

  it('headroom tie-break picks the less-loaded start, earliest among equals', () => {
    const availability = freeAvailability({ a: 3 }, { 'a|2026-11-24|9': 1, 'a|2026-11-24|10': 1 });
    const plan = planSessions(
      base({
        items: [{ equipmentId: 'a', qty: 1 }],
        sessionHours: 2,
        totalSessions: 1,
        availability,
      }),
    );
    expect(plan.sessions).toEqual([{ date: '2026-11-24', startHour: 11, endHour: 13 }]);
  });

  it('returns complete: false and the blocking items for an impossible request', () => {
    const plan = planSessions(base({ availability: freeAvailability({ a: 0, b: 2 }) }));
    expect(plan.complete).toBe(false);
    expect(plan.found).toBe(0);
    expect(plan.unavailableItems).toEqual(['a']);
  });

  it('treats missing availability as unavailable', () => {
    const plan = planSessions(base({ availability: {} }));
    expect(plan.found).toBe(0);
    expect(plan.unavailableItems).toEqual(['a', 'b']);
  });
});
