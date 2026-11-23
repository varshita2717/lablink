import { describe, expect, it } from 'vitest';
import {
  GENERIC_ERROR_MESSAGE,
  formatDate,
  formatHour,
  formatSession,
  friendlyError,
  roundScore,
} from '../format.js';
import { AppError, ERROR_CODES, isAppError } from '../errors.js';

describe('roundScore', () => {
  it('rounds half up without floating-point artefacts', () => {
    expect(roundScore(0.615)).toBe(0.62);
  });

  it('matches the seeded conflict scores', () => {
    expect(roundScore(0.8629)).toBe(0.86);
    expect(roundScore(0.3579)).toBe(0.36);
  });

  it('keeps exact values and zero', () => {
    expect(roundScore(1)).toBe(1);
    expect(roundScore(0)).toBe(0);
  });
});

describe('formatHour', () => {
  it('pads to HH:00', () => {
    expect(formatHour(9)).toBe('09:00');
    expect(formatHour(16)).toBe('16:00');
    expect(formatHour(0)).toBe('00:00');
  });

  it.each([[-1], [25], [9.5], ['10']])('throws for %s', (bad) => {
    expect(() => formatHour(bad)).toThrow(TypeError);
  });
});

describe('formatDate', () => {
  it('formats as weekday, day and month', () => {
    expect(formatDate('2026-11-24')).toBe('Tue 24 Nov');
    expect(formatDate('2027-01-01')).toBe('Fri 1 Jan');
  });

  it.each([['2026-02-30'], ['2026-11-24T00:00'], [''], [undefined]])('throws for %s', (bad) => {
    expect(() => formatDate(bad)).toThrow(TypeError);
  });
});

describe('formatSession', () => {
  it('formats a date and hour range', () => {
    expect(formatSession({ date: '2026-11-26', startHour: 10, endHour: 13 })).toBe(
      'Thu 26 Nov, 10:00–13:00',
    );
  });
});

describe('friendlyError', () => {
  it.each(Object.values(ERROR_CODES))('has specific friendly text for %s', (code) => {
    const message = friendlyError(code);
    expect(message).toBeTruthy();
    expect(message).not.toBe(GENERIC_ERROR_MESSAGE);
    expect(message).not.toContain(code);
  });

  it('gives every code a distinct message', () => {
    const messages = Object.values(ERROR_CODES).map(friendlyError);
    expect(new Set(messages).size).toBe(messages.length);
  });

  it('reads the code from an AppError', () => {
    const error = new AppError(ERROR_CODES.SLOT_FULL);
    expect(friendlyError(error)).toBe(friendlyError(ERROR_CODES.SLOT_FULL));
  });

  it('maps Firebase permission errors, with or without a service prefix', () => {
    const notAuthorized = friendlyError(ERROR_CODES.NOT_AUTHORIZED);
    expect(friendlyError({ code: 'permission-denied' })).toBe(notAuthorized);
    expect(friendlyError({ code: 'firestore/permission-denied' })).toBe(notAuthorized);
  });

  it('falls back to a generic message for unknown or missing codes', () => {
    expect(friendlyError('something-else')).toBe(GENERIC_ERROR_MESSAGE);
    expect(friendlyError(new Error('boom'))).toBe(GENERIC_ERROR_MESSAGE);
    expect(friendlyError(undefined)).toBe(GENERIC_ERROR_MESSAGE);
    expect(friendlyError(null)).toBe(GENERIC_ERROR_MESSAGE);
  });
});

describe('AppError', () => {
  it('carries a code and details and is detectable', () => {
    const error = new AppError(ERROR_CODES.LIMIT_EXCEEDED, 'too many', { date: '2026-11-24' });
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('AppError');
    expect(error.details).toEqual({ date: '2026-11-24' });
    expect(isAppError(error, ERROR_CODES.LIMIT_EXCEEDED)).toBe(true);
    expect(isAppError(error, ERROR_CODES.SLOT_FULL)).toBe(false);
    expect(isAppError(new Error('x'), ERROR_CODES.SLOT_FULL)).toBe(false);
  });

  it('defaults the message to the code', () => {
    expect(new AppError(ERROR_CODES.INVALID_INPUT).message).toBe(ERROR_CODES.INVALID_INPUT);
  });
});
