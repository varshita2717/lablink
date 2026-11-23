import { describe, expect, it } from 'vitest';
import {
  addDays,
  daysBetween,
  isWorkingDay,
  nextWorkingDay,
  today,
  workingDaysInRange,
} from '../dates.js';
import { AppError, ERROR_CODES } from '../errors.js';

// 2026-11-23 is a Monday; 2026-11-27 a Friday; 2026-11-28 a Saturday.
describe('today', () => {
  it('uses the campus time zone (Asia/Kolkata, UTC+5:30)', () => {
    // 20:00 UTC on 23 Nov is already 01:30 on 24 Nov in Kolkata.
    expect(today(new Date('2026-11-23T20:00:00Z'))).toBe('2026-11-24');
    expect(today(new Date('2026-11-23T10:00:00Z'))).toBe('2026-11-23');
  });

  it('returns a YYYY-MM-DD string by default', () => {
    expect(today()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('isWorkingDay', () => {
  it('is true Monday to Friday', () => {
    expect(isWorkingDay('2026-11-23')).toBe(true);
    expect(isWorkingDay('2026-11-27')).toBe(true);
  });

  it('is false on Saturday and Sunday', () => {
    expect(isWorkingDay('2026-11-28')).toBe(false);
    expect(isWorkingDay('2026-11-29')).toBe(false);
  });
});

describe('nextWorkingDay', () => {
  it('moves to the next day mid-week', () => {
    expect(nextWorkingDay('2026-11-23')).toBe('2026-11-24');
  });

  it('skips the weekend from Friday and Saturday', () => {
    expect(nextWorkingDay('2026-11-27')).toBe('2026-11-30');
    expect(nextWorkingDay('2026-11-28')).toBe('2026-11-30');
  });
});

describe('addDays', () => {
  it('crosses a month end', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
  });

  it('crosses a year end and handles negative offsets', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-12-01', -1)).toBe('2026-11-30');
  });

  it('handles leap years', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });

  it('rejects a non-integer day count', () => {
    expect(() => addDays('2026-11-23', 1.5)).toThrow(AppError);
  });
});

describe('daysBetween', () => {
  it('counts calendar days, signed', () => {
    expect(daysBetween('2026-11-23', '2026-11-23')).toBe(0);
    expect(daysBetween('2026-11-23', '2026-12-07')).toBe(14);
    expect(daysBetween('2026-12-07', '2026-11-23')).toBe(-14);
  });

  it('crosses a month end', () => {
    expect(daysBetween('2026-11-30', '2026-12-01')).toBe(1);
  });
});

describe('workingDaysInRange', () => {
  it('lists working days inclusive, skipping the weekend', () => {
    expect(workingDaysInRange('2026-11-26', '2026-12-01')).toEqual([
      '2026-11-26',
      '2026-11-27',
      '2026-11-30',
      '2026-12-01',
    ]);
  });

  it('returns 10 working days over two full weeks', () => {
    expect(workingDaysInRange('2026-11-23', '2026-12-06')).toHaveLength(10);
  });

  it('is empty for a weekend-only or reversed range', () => {
    expect(workingDaysInRange('2026-11-28', '2026-11-29')).toEqual([]);
    expect(workingDaysInRange('2026-11-30', '2026-11-23')).toEqual([]);
  });
});

describe('invalid input', () => {
  it.each([['2026-13-01'], ['2026-02-30'], ['26-11-23'], [''], [null], [20261123]])(
    'throws INVALID_INPUT for %s',
    (bad) => {
      expect(() => isWorkingDay(bad)).toThrow(
        expect.objectContaining({ code: ERROR_CODES.INVALID_INPUT }),
      );
    },
  );
});
