/**
 * Application error codes (SPEC Section 2.1). Friendly text for each code
 * lives in one place: `friendlyError` in format.js.
 */
export const ERROR_CODES = Object.freeze({
  SLOT_FULL: 'SLOT_FULL',
  LIMIT_EXCEEDED: 'LIMIT_EXCEEDED',
  INVALID_INPUT: 'INVALID_INPUT',
  NOT_AUTHORIZED: 'NOT_AUTHORIZED',
  EQUIPMENT_INACTIVE: 'EQUIPMENT_INACTIVE',
  OUT_OF_HORIZON: 'OUT_OF_HORIZON',
  AI_UNAVAILABLE: 'AI_UNAVAILABLE',
});

/** An error carrying one of the ERROR_CODES plus optional structured details. */
export class AppError extends Error {
  /**
   * @param {string} code One of ERROR_CODES.
   * @param {string} [message] Developer-facing message (never shown to users directly).
   * @param {object} [details] Extra structured context, e.g. the failing slot.
   */
  constructor(code, message = code, details = undefined) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.details = details;
  }
}

/**
 * Checks whether a value is an AppError with the given code.
 * @param {unknown} error The value to test.
 * @param {string} code One of ERROR_CODES.
 * @returns {boolean} True if `error` is an AppError with that code.
 */
export function isAppError(error, code) {
  return error instanceof AppError && error.code === code;
}
