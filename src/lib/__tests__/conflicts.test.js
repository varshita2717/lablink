import { describe, expect, it, vi } from 'vitest';
import {
  countDistinctHours,
  findConflictGroups,
  resolveGroup,
  scoreRequest,
} from '../conflicts.js';
import { buildAvailability } from '../booking.js';
import { buildSeedData } from '../seed.js';
import { addDays, horizonDates, nextWorkingDay } from '../dates.js';
import { roundScore } from '../format.js';

vi.mock('../firebase.js', () => ({ db: {} }));
vi.mock('../inventory.js', () => ({ invalidateInventory: () => {} }));

const TODAY = '2026-11-23';
const seed = buildSeedData(TODAY);
const equipmentById = Object.fromEntries(seed.equipment.map((item) => [item.id, item]));
const availability = buildAvailability(seed.equipment, horizonDates(TODAY), seed.slots);
const requests = seed.requests.map((request, index) => ({ ...request, createdAt: 1000 + index }));
const hoursUsed30dByStudent = Object.fromEntries(
  ['seed-aarav', 'seed-rohan', 'seed-meera'].map((uid) => [
    uid,
    countDistinctHours(
      seed.bookings.filter((b) => b.userUid === uid),
      addDays(TODAY, -30),
      TODAY,
    ),
  ]),
);

describe('countDistinctHours', () => {
  it('counts distinct confirmed (date, hour) pairs inside the window', () => {
    const bookings = [
      { date: '2026-11-20', startHour: 9, endHour: 11, status: 'confirmed' },
      { date: '2026-11-20', startHour: 10, endHour: 12, status: 'confirmed' },
      { date: '2026-11-19', startHour: 9, endHour: 13, status: 'cancelled' },
      { date: '2026-10-01', startHour: 9, endHour: 10, status: 'confirmed' },
    ];
    expect(countDistinctHours(bookings, '2026-10-24', TODAY)).toBe(3);
  });

  it('matches the seeded usage: 2, 5 and 15 hours', () => {
    expect(hoursUsed30dByStudent).toEqual({ 'seed-aarav': 2, 'seed-rohan': 5, 'seed-meera': 15 });
  });
});

describe('scoreRequest', () => {
  it('reproduces the seeded totals and their display values', () => {
    const totals = requests.map(
      (r) => scoreRequest(r, hoursUsed30dByStudent[r.studentUid], TODAY).total,
    );
    const [aarav, rohan, meera] = ['seed-aarav', 'seed-rohan', 'seed-meera'].map(
      (uid) => totals[requests.findIndex((r) => r.studentUid === uid)],
    );
    expect(aarav).toBeCloseTo(0.8629, 4);
    expect(rohan).toBeCloseTo(0.615, 4);
    expect(meera).toBeCloseTo(0.3579, 4);
    expect([aarav, rohan, meera].map(roundScore)).toEqual([0.86, 0.62, 0.36]);
  });

  it('clamps urgency for past deadlines and caps fairness', () => {
    const score = scoreRequest({ deadline: '2026-11-01', stage: 'idea' }, 40, TODAY);
    expect(score).toEqual({ urgency: 1, fairness: 0, stage: 0.3, total: 0.5 + 0.06 });
    const far = scoreRequest({ deadline: '2027-06-01', stage: 'unknown' }, 0, TODAY);
    expect(far.urgency).toBe(0);
    expect(far.stage).toBe(0);
  });
});

describe('findConflictGroups', () => {
  it('groups the three seeded oscilloscope requests and leaves a non-overlapping request out', () => {
    const separate = {
      ...requests[0],
      id: 'later',
      sessions: [{ date: nextWorkingDay(TODAY), startHour: 14, endHour: 16 }],
    };
    const groups = findConflictGroups([...requests, separate], equipmentById, availability);
    expect(groups).toHaveLength(1);
    expect(groups[0].requestIds).toEqual(requests.map((r) => r.id));
    const date = nextWorkingDay(TODAY);
    expect(groups[0].conflictedKeys).toEqual([
      `eq-oscilloscope|${date}|10`,
      `eq-oscilloscope|${date}|11`,
    ]);
  });

  it('reports nothing when demand fits, and falls back to quantity without availability', () => {
    expect(findConflictGroups([requests[0]], equipmentById, availability)).toEqual([]);
    expect(findConflictGroups(requests.slice(0, 2), equipmentById, {})).toHaveLength(1);
  });

  it('merges chains of overlapping requests into one group (union-find)', () => {
    const date = nextWorkingDay(TODAY);
    const at = (id, startHour, endHour) => ({
      ...requests[0],
      id,
      sessions: [{ date, startHour, endHour }],
    });
    const groups = findConflictGroups(
      [at('a', 9, 11), at('b', 10, 12), at('c', 11, 13)],
      equipmentById,
      availability,
    );
    expect(groups).toEqual([expect.objectContaining({ requestIds: ['a', 'b', 'c'] })]);
  });
});

describe('resolveGroup', () => {
  const resolve = (group, overrides = {}) =>
    resolveGroup({
      requests: group,
      availability,
      hoursUsed30dByStudent,
      userHoursByStudent: {},
      substitutes: {},
      today: TODAY,
      ...overrides,
    });

  it('ranks Aarav > Rohan > Meera; only Aarav wins and both losers get alternatives', () => {
    const { ranking } = resolve(requests);
    expect(ranking.map((e) => e.studentName)).toEqual(['Aarav Sharma', 'Rohan Das', 'Meera Iyer']);
    expect(ranking.map((e) => e.rank)).toEqual([1, 2, 3]);
    expect(ranking.map((e) => roundScore(e.score.total))).toEqual([0.86, 0.62, 0.36]);
    expect(ranking.map((e) => e.isWinner)).toEqual([true, false, false]);
    expect(ranking[0].alternatives).toBeNull();
    for (const loser of ranking.slice(1)) {
      expect(loser.alternatives.complete).toBe(true);
      expect(loser.alternatives.sessions).toHaveLength(1);
      expect(
        loser.alternatives.sessions[0].endHour - loser.alternatives.sessions[0].startHour,
      ).toBe(2);
    }
    // Losers are re-planned around the winner: never the winner's 10:00-12:00 slot.
    const winnerSlot = requests[0].sessions[0];
    for (const loser of ranking.slice(1)) {
      expect(loser.alternatives.sessions[0]).not.toEqual(winnerSlot);
    }
  });

  it('does not mutate the input availability', () => {
    const before = JSON.stringify(availability);
    resolve(requests);
    expect(JSON.stringify(availability)).toBe(before);
  });

  it('breaks ties by earlier createdAt', () => {
    const twin = (id, createdAt) => ({
      ...requests[0],
      id,
      studentUid: id,
      studentName: id,
      createdAt,
    });
    const { ranking } = resolve([twin('late', 2000), twin('early', 1000)], {
      hoursUsed30dByStudent: {},
    });
    expect(ranking.map((e) => e.requestId)).toEqual(['early', 'late']);
    expect(ranking[0].isWinner).toBe(true);
  });

  it('is all-or-nothing: a request with one item that does not fit loses entirely', () => {
    const date = nextWorkingDay(TODAY);
    const session = [{ date, startHour: 10, endHour: 12 }];
    const scopeOnly = { ...requests[0], id: 'scope-only', createdAt: 1 };
    const both = {
      ...requests[2],
      id: 'both',
      createdAt: 2,
      sessions: session,
      items: [
        { equipmentId: 'eq-multimeter', equipmentName: 'Multimeter', qty: 10 },
        { equipmentId: 'eq-oscilloscope', equipmentName: 'Digital Oscilloscope', qty: 1 },
      ],
    };
    const multimeterOnly = {
      ...requests[1],
      id: 'multimeter-only',
      createdAt: 3,
      sessions: session,
      items: [{ equipmentId: 'eq-multimeter', equipmentName: 'Multimeter', qty: 10 }],
    };
    const { ranking } = resolve([scopeOnly, both, multimeterOnly]);
    const outcome = Object.fromEntries(ranking.map((e) => [e.requestId, e.isWinner]));
    // "both" loses, so its multimeter units stay free and the lower-ranked request still wins.
    expect(outcome).toEqual({ 'scope-only': true, both: false, 'multimeter-only': true });
  });
});
