import { describe, expect, it, vi } from 'vitest';
import {
  applyEntriesToSlots,
  checkDailyLimit,
  hoursByDate,
  releaseFromSlot,
  validateEntries,
} from '../booking.js';
import { ERROR_CODES } from '../errors.js';

vi.mock('../firebase.js', () => ({ db: {} }));

const TODAY = '2026-11-23'; // Monday
const scope = { id: 'scope', name: 'Digital Oscilloscope', quantity: 1 };
const flask = { id: 'flask', name: 'Flask', quantity: 10 };
const entry = (overrides) => ({
  equipment: flask,
  date: '2026-11-24',
  startHour: 10,
  endHour: 12,
  qty: 1,
  ...overrides,
});
const withCode = (code) => expect.objectContaining({ code });

describe('validateEntries', () => {
  it('accepts valid entries, including the horizon edges', () => {
    expect(() => validateEntries([entry()], TODAY)).not.toThrow();
    expect(() =>
      validateEntries([entry({ date: '2026-12-07', startHour: 9, endHour: 17, qty: 10 })], TODAY),
    ).not.toThrow();
  });

  it.each([
    ['a weekend', '2026-11-28'],
    ['today', TODAY],
    ['the past', '2026-11-20'],
    ['beyond the horizon', '2026-12-08'],
  ])('rejects %s with OUT_OF_HORIZON', (_label, date) => {
    expect(() => validateEntries([entry({ date })], TODAY)).toThrow(
      withCode(ERROR_CODES.OUT_OF_HORIZON),
    );
  });

  it.each([
    ['start before opening', { startHour: 8 }],
    ['end after closing', { endHour: 18 }],
    ['start equal to end', { startHour: 12, endHour: 12 }],
    ['start after end', { startHour: 13, endHour: 12 }],
    ['fractional hour', { startHour: 9.5 }],
    ['string hour', { endHour: '12' }],
    ['zero quantity', { qty: 0 }],
    ['quantity above capacity', { qty: 11 }],
    ['fractional quantity', { qty: 1.5 }],
    ['malformed date', { date: '24-11-2026' }],
    ['missing equipment', { equipment: undefined }],
  ])('rejects %s with INVALID_INPUT', (_label, overrides) => {
    expect(() => validateEntries([entry(overrides)], TODAY)).toThrow(
      withCode(ERROR_CODES.INVALID_INPUT),
    );
  });

  it('rejects empty input and more than 8 distinct items', () => {
    expect(() => validateEntries([], TODAY)).toThrow(withCode(ERROR_CODES.INVALID_INPUT));
    expect(() => validateEntries(null, TODAY)).toThrow(withCode(ERROR_CODES.INVALID_INPUT));
    const nine = Array.from({ length: 9 }, (_, i) =>
      entry({ equipment: { ...flask, id: `e${i}` } }),
    );
    expect(() => validateEntries(nine, TODAY)).toThrow(withCode(ERROR_CODES.INVALID_INPUT));
    expect(() => validateEntries(nine.slice(0, 8), TODAY)).not.toThrow();
  });
});

describe('checkDailyLimit', () => {
  it('counts distinct hours across existing and new bookings', () => {
    const existing = [{ date: '2026-11-24', startHour: 9, endHour: 11 }];
    expect(() => checkDailyLimit(existing, [entry({ startHour: 10, endHour: 13 })])).not.toThrow();
    expect(() => checkDailyLimit(existing, [entry({ startHour: 11, endHour: 14 })])).toThrow(
      withCode(ERROR_CODES.LIMIT_EXCEEDED),
    );
  });

  it('checks each date separately', () => {
    const existing = [{ date: '2026-11-25', startHour: 9, endHour: 13 }];
    expect(() => checkDailyLimit(existing, [entry({ startHour: 9, endHour: 13 })])).not.toThrow();
  });
});

describe('hoursByDate', () => {
  it('merges overlapping ranges into sorted distinct hours', () => {
    expect(
      hoursByDate([
        { date: 'd', startHour: 11, endHour: 13 },
        { date: 'd', startHour: 9, endHour: 12 },
      ]),
    ).toEqual({ d: [9, 10, 11, 12] });
  });
});

describe('applyEntriesToSlots (capacity)', () => {
  it('adds units per hour without mutating the input', () => {
    const current = { 'flask_2026-11-24': { 10: 3 } };
    const updated = applyEntriesToSlots(current, [entry({ qty: 2 })]);
    expect(updated['flask_2026-11-24']).toEqual({ 10: 5, 11: 2 });
    expect(current['flask_2026-11-24']).toEqual({ 10: 3 });
  });

  it('booking 6 hours of a 1-unit item twice fails the second time', () => {
    const six = entry({ equipment: scope, startHour: 9, endHour: 15 });
    const afterFirst = applyEntriesToSlots({}, [six]);
    expect(afterFirst['scope_2026-11-24']).toEqual({ 9: 1, 10: 1, 11: 1, 12: 1, 13: 1, 14: 1 });
    expect(() => applyEntriesToSlots(afterFirst, [six])).toThrow(withCode(ERROR_CODES.SLOT_FULL));
  });

  it('is all-or-nothing across multiple entries', () => {
    const current = { 'scope_2026-11-25': { 10: 1 } };
    const entries = [
      entry(),
      entry({ equipment: scope, date: '2026-11-25', startHour: 10, endHour: 11 }),
    ];
    expect(() => applyEntriesToSlots(current, entries)).toThrow(withCode(ERROR_CODES.SLOT_FULL));
    expect(current).toEqual({ 'scope_2026-11-25': { 10: 1 } });
  });

  it('counts two entries for the same slot together', () => {
    const twice = [entry({ equipment: scope }), entry({ equipment: scope, startHour: 11 })];
    expect(() => applyEntriesToSlots({}, twice)).toThrow(withCode(ERROR_CODES.SLOT_FULL));
  });
});

describe('releaseFromSlot (cancel frees capacity)', () => {
  it('decrements the booked hours, never below zero', () => {
    const hours = { 9: 1, 10: 1, 11: 3 };
    expect(releaseFromSlot(hours, { startHour: 10, endHour: 12, qty: 1 })).toEqual({
      9: 1,
      10: 0,
      11: 2,
    });
    expect(releaseFromSlot({}, { startHour: 9, endHour: 10, qty: 2 })).toEqual({ 9: 0 });
  });

  it('lets a 1-unit item be booked again after cancelling', () => {
    const booking = entry({ equipment: scope });
    const booked = applyEntriesToSlots({}, [booking])['scope_2026-11-24'];
    const freed = releaseFromSlot(booked, booking);
    expect(() => applyEntriesToSlots({ 'scope_2026-11-24': freed }, [booking])).not.toThrow();
  });
});
