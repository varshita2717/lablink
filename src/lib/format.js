// PURE: no Firebase, no React.
import { SCORE_DECIMALS } from './config.js';
import { ERROR_CODES } from './errors.js';

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const SCORE_FACTOR = 10 ** SCORE_DECIMALS;

const FRIENDLY_MESSAGES = Object.freeze({
  [ERROR_CODES.SLOT_FULL]:
    'That slot was just taken. Please pick another time; availability has been refreshed.',
  [ERROR_CODES.LIMIT_EXCEEDED]:
    'This would exceed the daily limit of lab hours per student. Try fewer hours or another day.',
  [ERROR_CODES.INVALID_INPUT]: 'Some of the details are not valid. Please check and try again.',
  [ERROR_CODES.NOT_AUTHORIZED]: 'You do not have permission to do that.',
  [ERROR_CODES.EQUIPMENT_INACTIVE]: 'This equipment is not available for booking right now.',
  [ERROR_CODES.OUT_OF_HORIZON]:
    'Bookings can be made only for working days from tomorrow up to two weeks ahead.',
  [ERROR_CODES.AI_UNAVAILABLE]:
    'The assistant is unavailable right now. You can still browse and book from the Catalogue.',
});

/** Firebase error codes that map onto an app error code. */
const FIREBASE_CODE_MAP = Object.freeze({
  'permission-denied': ERROR_CODES.NOT_AUTHORIZED,
  unauthenticated: ERROR_CODES.NOT_AUTHORIZED,
  'invalid-argument': ERROR_CODES.INVALID_INPUT,
});

export const GENERIC_ERROR_MESSAGE = 'Something went wrong. Please try again.';

/**
 * Rounds a score for display, avoiding floating-point artefacts (0.615 → 0.62).
 * @param {number} value Unrounded score.
 * @returns {number} The value rounded to SCORE_DECIMALS places.
 */
export function roundScore(value) {
  return Math.round((value + Number.EPSILON) * SCORE_FACTOR) / SCORE_FACTOR;
}

/**
 * Formats an hour of the day as a 24-hour clock label.
 * @param {number} hour Integer hour 0-24.
 * @returns {string} e.g. `"09:00"`.
 * @throws {TypeError} If `hour` is not an integer from 0 to 24.
 */
export function formatHour(hour) {
  if (!Number.isInteger(hour) || hour < 0 || hour > 24) {
    throw new TypeError(`Invalid hour: ${hour}`);
  }
  return `${String(hour).padStart(2, '0')}:00`;
}

/**
 * Formats a `YYYY-MM-DD` date as a short label, independent of the browser locale.
 * @param {string} date Date string `YYYY-MM-DD`.
 * @returns {string} e.g. `"Tue 24 Nov"`.
 * @throws {TypeError} If `date` is not a valid `YYYY-MM-DD` string.
 */
export function formatDate(date) {
  const match = typeof date === 'string' ? DATE_PATTERN.exec(date) : null;
  if (!match) throw new TypeError(`Invalid date: ${date}`);
  const [, year, month, day] = match.map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
    throw new TypeError(`Invalid date: ${date}`);
  }
  return `${WEEKDAY_NAMES[parsed.getUTCDay()]} ${day} ${MONTH_NAMES[month - 1]}`;
}

/**
 * Formats a session as a readable range.
 * @param {{ date: string, startHour: number, endHour: number }} session
 * @returns {string} e.g. `"Thu 26 Nov, 10:00–13:00"`.
 * @throws {TypeError} If the date or hours are invalid.
 */
export function formatSession({ date, startHour, endHour }) {
  return `${formatDate(date)}, ${formatHour(startHour)}–${formatHour(endHour)}`;
}

/**
 * Maps an error code (or an error object with a `code`) to user-facing text.
 * Accepts app codes from errors.js and common Firebase codes (`permission-denied`, `firestore/permission-denied`).
 * @param {string | { code?: string } | null | undefined} codeOrError
 * @returns {string} A friendly, non-technical message; a generic one for unknown codes.
 */
export function friendlyError(codeOrError) {
  const raw = typeof codeOrError === 'string' ? codeOrError : codeOrError?.code;
  if (typeof raw !== 'string') return GENERIC_ERROR_MESSAGE;
  if (FRIENDLY_MESSAGES[raw]) return FRIENDLY_MESSAGES[raw];
  const firebaseCode = raw.includes('/') ? raw.slice(raw.indexOf('/') + 1) : raw;
  const mapped = FIREBASE_CODE_MAP[firebaseCode];
  return mapped ? FRIENDLY_MESSAGES[mapped] : GENERIC_ERROR_MESSAGE;
}
