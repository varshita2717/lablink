// PURE: no Firebase, no React. Validators for user input and model tool arguments (SPEC 2.2).
// Each throws AppError(INVALID_INPUT | OUT_OF_HORIZON) with a short reason the model can read.
import {
  MAX_CHAT_INPUT,
  MAX_DAYS_AHEAD,
  MAX_DESCRIPTION,
  MAX_FACULTY_NAME,
  MAX_ITEMS_PER_PLAN,
  MAX_JUSTIFICATION,
  MAX_PLAN_WEEKS,
  MAX_PROJECT_DEADLINE_DAYS,
  MAX_SESSION_HOURS,
  MAX_SESSIONS_PER_WEEK,
  MAX_TITLE,
  MIN_SESSION_HOURS,
  STAGES,
} from './config.js';
import { AppError, ERROR_CODES } from './errors.js';
import { daysBetween, isWorkingDay } from './dates.js';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const fail = (message) => new AppError(ERROR_CODES.INVALID_INPUT, message);

/**
 * Trims and length-checks free text.
 * @param {unknown} value
 * @param {number} max Maximum length after trimming.
 * @param {{ field?: string, required?: boolean }} [options]
 * @returns {string} The trimmed text.
 * @throws {AppError} INVALID_INPUT if not a string, empty when required, or too long.
 */
export function validateText(value, max, { field = 'text', required = true } = {}) {
  if (value === undefined || value === null) {
    if (required) throw fail(`${field} is required`);
    return '';
  }
  if (typeof value !== 'string') throw fail(`${field} must be text`);
  const text = value.trim();
  if (required && text.length === 0) throw fail(`${field} is required`);
  if (text.length > max) throw fail(`${field} must be at most ${max} characters`);
  return text;
}

/**
 * Validates a chat message from the user.
 * @param {unknown} text
 * @returns {string} Trimmed message (1 to MAX_CHAT_INPUT characters).
 * @throws {AppError} INVALID_INPUT.
 */
export function validateChatInput(text) {
  return validateText(text, MAX_CHAT_INPUT, { field: 'message' });
}

/**
 * Validates a real calendar date in `YYYY-MM-DD` form.
 * @param {unknown} value
 * @param {string} [field]
 * @returns {string}
 * @throws {AppError} INVALID_INPUT.
 */
export function validateDate(value, field = 'date') {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value))
    throw fail(`${field} must be YYYY-MM-DD`);
  try {
    isWorkingDay(value); // throws for impossible dates such as 2026-02-30
  } catch {
    throw fail(`${field} is not a real date`);
  }
  return value;
}

/**
 * Validates a bookable date: a working day from tomorrow to today + MAX_DAYS_AHEAD.
 * @param {unknown} value
 * @param {string} today
 * @returns {string}
 * @throws {AppError} INVALID_INPUT for a malformed date; OUT_OF_HORIZON otherwise.
 */
export function validateHorizonDate(value, today) {
  const date = validateDate(value);
  const offset = daysBetween(today, date);
  if (offset < 1 || offset > MAX_DAYS_AHEAD || !isWorkingDay(date)) {
    throw new AppError(
      ERROR_CODES.OUT_OF_HORIZON,
      'date must be a working day in the next 14 days',
    );
  }
  return date;
}

/**
 * Validates an integer in a range (no numeric strings).
 * @param {unknown} value
 * @param {number} min
 * @param {number} max
 * @param {string} [field]
 * @returns {number}
 * @throws {AppError} INVALID_INPUT.
 */
export function validateInteger(value, min, max, field = 'value') {
  if (typeof value !== 'number' || !Number.isInteger(value))
    throw fail(`${field} must be a whole number`);
  if (value < min || value > max) throw fail(`${field} must be from ${min} to ${max}`);
  return value;
}

/**
 * Validates an enum value.
 * @param {unknown} value
 * @param {string[]} allowed
 * @param {string} [field]
 * @returns {string}
 * @throws {AppError} INVALID_INPUT.
 */
export function validateEnum(value, allowed, field = 'value') {
  if (!allowed.includes(value)) throw fail(`${field} must be one of: ${allowed.join(', ')}`);
  return value;
}

/**
 * Validates an ID that must exist in loaded data.
 * @param {unknown} value
 * @param {Record<string, unknown>} byId
 * @param {string} [field]
 * @returns {string}
 * @throws {AppError} INVALID_INPUT for a wrong type or unknown ID.
 */
export function validateId(value, byId, field = 'id') {
  if (typeof value !== 'string' || !Object.hasOwn(byId, value))
    throw fail(`unknown ${field}: ${value}`);
  return value;
}

/** A future deadline within MAX_PROJECT_DEADLINE_DAYS. */
function validateDeadline(value, today) {
  const deadline = validateDate(value, 'deadline');
  const offset = daysBetween(today, deadline);
  if (offset < 1 || offset > MAX_PROJECT_DEADLINE_DAYS) {
    throw fail(`deadline must be after today and within ${MAX_PROJECT_DEADLINE_DAYS} days`);
  }
  return deadline;
}

const asObject = (args) => (args && typeof args === 'object' && !Array.isArray(args) ? args : {});

/**
 * recommend_equipment arguments.
 * @param {unknown} args
 * @returns {{ description: string }}
 * @throws {AppError} INVALID_INPUT.
 */
export function validateRecommendArgs(args) {
  return {
    description: validateText(asObject(args).description, MAX_DESCRIPTION, {
      field: 'description',
    }),
  };
}

/**
 * check_availability arguments.
 * @param {unknown} args
 * @param {Record<string, object>} equipmentById Active equipment.
 * @param {string} today
 * @returns {{ equipmentId: string, date: string }}
 * @throws {AppError} INVALID_INPUT or OUT_OF_HORIZON.
 */
export function validateCheckAvailabilityArgs(args, equipmentById, today) {
  const { equipmentId, date } = asObject(args);
  return {
    equipmentId: validateId(equipmentId, equipmentById, 'equipmentId'),
    date: validateHorizonDate(date, today),
  };
}

/**
 * find_slots arguments.
 * @param {unknown} args
 * @param {Record<string, { quantity: number }>} equipmentById Active equipment.
 * @param {string} today
 * @returns {{ items: { equipmentId: string, qty: number }[], sessionHours: number,
 *             sessionsPerWeek: number, numWeeks: number | null, deadline: string | null }}
 * @throws {AppError} INVALID_INPUT.
 */
export function validateFindSlotsArgs(args, equipmentById, today) {
  const input = asObject(args);
  if (
    !Array.isArray(input.items) ||
    input.items.length < 1 ||
    input.items.length > MAX_ITEMS_PER_PLAN
  ) {
    throw fail(`items must list 1 to ${MAX_ITEMS_PER_PLAN} equipment`);
  }
  const seen = new Set();
  const items = input.items.map((raw) => {
    const item = asObject(raw);
    const equipmentId = validateId(item.equipmentId, equipmentById, 'equipmentId');
    if (seen.has(equipmentId)) throw fail(`duplicate equipmentId: ${equipmentId}`);
    seen.add(equipmentId);
    const qty = validateInteger(item.qty, 1, equipmentById[equipmentId].quantity, 'qty');
    return { equipmentId, qty };
  });
  return {
    items,
    sessionHours: validateInteger(
      input.sessionHours,
      MIN_SESSION_HOURS,
      MAX_SESSION_HOURS,
      'sessionHours',
    ),
    sessionsPerWeek: validateInteger(
      input.sessionsPerWeek,
      1,
      MAX_SESSIONS_PER_WEEK,
      'sessionsPerWeek',
    ),
    numWeeks:
      input.numWeeks == null
        ? null
        : validateInteger(input.numWeeks, 1, MAX_PLAN_WEEKS, 'numWeeks'),
    deadline: input.deadline == null ? null : validateDeadline(input.deadline, today),
  };
}

/**
 * draft_project arguments.
 * @param {unknown} args
 * @param {string} today
 * @returns {{ title: string, description: string, deadline: string, stage: string,
 *             facultyGuideName: string }}
 * @throws {AppError} INVALID_INPUT.
 */
export function validateDraftProjectArgs(args, today) {
  const input = asObject(args);
  return {
    title: validateText(input.title, MAX_TITLE, { field: 'title' }),
    description: validateText(input.description, MAX_DESCRIPTION, {
      field: 'description',
      required: false,
    }),
    deadline: validateDeadline(input.deadline, today),
    stage: validateEnum(input.stage, STAGES, 'stage'),
    facultyGuideName: validateText(input.facultyGuideName, MAX_FACULTY_NAME, {
      field: 'facultyGuideName',
    }),
  };
}

/**
 * draft_plan arguments. The plan and project must already exist (stored planner output and the
 * user's own projects), so the model cannot invent sessions or projects.
 * @param {unknown} args
 * @param {Record<string, object>} plansById
 * @param {Record<string, object>} projectsById The user's projects.
 * @returns {{ planId: string, projectId: string, justification: string }}
 * @throws {AppError} INVALID_INPUT.
 */
export function validateDraftPlanArgs(args, plansById, projectsById) {
  const input = asObject(args);
  return {
    planId: validateId(input.planId, plansById, 'planId'),
    projectId: validateId(input.projectId, projectsById, 'projectId'),
    justification: validateText(input.justification, MAX_JUSTIFICATION, {
      field: 'justification',
      required: false,
    }),
  };
}
