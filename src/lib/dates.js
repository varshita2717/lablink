// PURE: no Firebase, no React.
// Dates are `YYYY-MM-DD` strings in campus local time; arithmetic is done in UTC
// on the calendar date only, so results never depend on the browser's time zone.
import { CAMPUS_TIME_ZONE, MS_PER_DAY, WORKING_WEEKDAYS } from './config.js';
import { AppError, ERROR_CODES } from './errors.js';

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Parses a `YYYY-MM-DD` string into a UTC midnight timestamp.
 * @param {string} date
 * @returns {number} Milliseconds since the epoch at UTC midnight.
 * @throws {AppError} INVALID_INPUT if the string is not a real calendar date.
 */
function toUtcMs(date) {
  const match = typeof date === 'string' ? DATE_PATTERN.exec(date) : null;
  if (!match) throw new AppError(ERROR_CODES.INVALID_INPUT, `Invalid date: ${date}`);
  const [, year, month, day] = match.map(Number);
  const ms = Date.UTC(year, month - 1, day);
  const check = new Date(ms);
  if (check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    throw new AppError(ERROR_CODES.INVALID_INPUT, `Invalid date: ${date}`);
  }
  return ms;
}

/**
 * Formats a UTC timestamp as `YYYY-MM-DD`.
 * @param {number} ms
 * @returns {string}
 */
function fromUtcMs(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Returns today's date in the campus time zone.
 * @param {Date} [now] The current instant (injectable for tests).
 * @returns {string} `YYYY-MM-DD`.
 */
export function today(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: CAMPUS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (type) => parts.find((part) => part.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/**
 * Adds a whole number of days to a date.
 * @param {string} date `YYYY-MM-DD`.
 * @param {number} days Integer number of days (may be negative).
 * @returns {string} The resulting `YYYY-MM-DD`.
 * @throws {AppError} INVALID_INPUT for a bad date or non-integer `days`.
 */
export function addDays(date, days) {
  if (!Number.isInteger(days)) {
    throw new AppError(ERROR_CODES.INVALID_INPUT, `Invalid day count: ${days}`);
  }
  return fromUtcMs(toUtcMs(date) + days * MS_PER_DAY);
}

/**
 * Counts calendar days from one date to another.
 * @param {string} from `YYYY-MM-DD`.
 * @param {string} to `YYYY-MM-DD`.
 * @returns {number} `to - from` in days (negative if `to` is earlier).
 * @throws {AppError} INVALID_INPUT for a bad date.
 */
export function daysBetween(from, to) {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / MS_PER_DAY);
}

/**
 * Checks whether a date is a working day (Monday to Friday).
 * @param {string} date `YYYY-MM-DD`.
 * @returns {boolean}
 * @throws {AppError} INVALID_INPUT for a bad date.
 */
export function isWorkingDay(date) {
  return WORKING_WEEKDAYS.includes(new Date(toUtcMs(date)).getUTCDay());
}

/**
 * Returns the first working day strictly after the given date.
 * @param {string} date `YYYY-MM-DD`.
 * @returns {string} `YYYY-MM-DD`.
 * @throws {AppError} INVALID_INPUT for a bad date.
 */
export function nextWorkingDay(date) {
  let candidate = addDays(date, 1);
  while (!isWorkingDay(candidate)) candidate = addDays(candidate, 1);
  return candidate;
}

/**
 * Lists the working days between two dates, both inclusive, in order.
 * @param {string} from `YYYY-MM-DD`.
 * @param {string} to `YYYY-MM-DD`.
 * @returns {string[]} Working days; empty if `to` is before `from`.
 * @throws {AppError} INVALID_INPUT for a bad date.
 */
export function workingDaysInRange(from, to) {
  const span = daysBetween(from, to);
  const result = [];
  for (let offset = 0; offset <= span; offset += 1) {
    const date = addDays(from, offset);
    if (isWorkingDay(date)) result.push(date);
  }
  return result;
}
