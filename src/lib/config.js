/**
 * All application constants live here. No other module may hard-code limits,
 * weights, hours or labels (SPEC Section 2.1: no magic numbers).
 * firestore.rules mirrors SLOT_START_HOUR..SLOT_END_HOUR - 1 and is commented as such.
 */

export const APP_NAME = 'LabLink';
export const APP_TAGLINE = 'Making college laboratories more accessible.';

// ---------- Time and calendar ----------
/** Campus time zone; all `YYYY-MM-DD` dates are local to it. */
export const CAMPUS_TIME_ZONE = 'Asia/Kolkata';
/** First bookable hour (inclusive). */
export const SLOT_START_HOUR = 9;
/** Last bookable hour boundary (exclusive): slots run 9-16, ending at 17:00. */
export const SLOT_END_HOUR = 17;
/** Bookable hours per working day. */
export const HOURS_PER_DAY = SLOT_END_HOUR - SLOT_START_HOUR;
/** Bookings may be made from tomorrow up to this many days ahead. */
export const MAX_DAYS_AHEAD = 14;
/** ISO weekday numbers (Date#getUTCDay) that are working days: Monday to Friday. */
export const WORKING_WEEKDAYS = [1, 2, 3, 4, 5];
export const DAYS_PER_WEEK = 7;
/** Preferred gap between planned sessions, in days. */
export const MIN_DAYS_BETWEEN_SESSIONS = 2;
export const MS_PER_DAY = 86_400_000;

// ---------- Booking limits ----------
export const MAX_HOURS_PER_DAY = 4;
export const MAX_ITEMS_PER_PLAN = 8;
export const MAX_SESSIONS_PER_REQUEST = 10;
export const MAX_QUANTITY = 100;
export const MIN_SESSION_HOURS = 1;
export const MAX_SESSION_HOURS = 4;
export const MAX_SESSIONS_PER_WEEK = 5;
export const MAX_PLAN_WEEKS = 2;
export const MAX_PROJECT_DEADLINE_DAYS = 365;
/** Firestore `in` queries accept at most 30 values. */
export const FIRESTORE_IN_LIMIT = 30;

// ---------- Text limits ----------
export const MAX_CHAT_INPUT = 1000;
export const MAX_TITLE = 120;
export const MAX_DESCRIPTION = 1000;
export const MAX_JUSTIFICATION = 500;
export const MAX_COMMENT = 500;
export const MAX_SEARCH_QUERY = 200;
export const MAX_NAME = 80;
export const MAX_EQUIPMENT_NAME = 100;
export const MAX_EQUIPMENT_DESCRIPTION = 500;
export const MAX_REASON_TEXT = 120;
export const MAX_TAGS = 20;

// ---------- Enums ----------
export const ROLES = ['student', 'faculty', 'admin'];
export const STAFF_ROLES = ['faculty', 'admin'];
export const STAGES = ['idea', 'prototype', 'final'];
export const ACCESS_LEVELS = ['open', 'approval'];
export const HAZARD_LEVELS = ['none', 'moderate', 'high'];
export const EQUIPMENT_STATUSES = ['active', 'disabled', 'proposed'];
export const CATEGORIES = [
  'Measurement',
  'Dev Kit',
  'Workstation',
  'Fabrication',
  'Computing',
  'Glassware',
  'Heating',
];
export const REQUEST_STATUSES = [
  'pending',
  'approved',
  'rejected',
  'changes_requested',
  'conflict_lost',
];
export const BOOKING_STATUSES = ['confirmed', 'cancelled'];

// ---------- Display labels ----------
export const STATUS_LABELS = {
  pending: 'Pending',
  approved: 'Approved',
  confirmed: 'Confirmed',
  rejected: 'Rejected',
  changes_requested: 'Changes requested',
  conflict_lost: 'Not allocated',
  cancelled: 'Cancelled',
  proposed: 'Proposed',
  active: 'Active',
  disabled: 'Disabled',
};
export const ROLE_LABELS = { student: 'Student', faculty: 'Faculty', admin: 'Admin' };
export const STAGE_LABELS = { idea: 'Idea', prototype: 'Prototype', final: 'Final' };
export const ACCESS_LABELS = { open: 'Open booking', approval: 'Needs approval' };
export const HAZARD_LABELS = {
  none: 'No hazard',
  moderate: 'Moderate hazard',
  high: 'High hazard',
};
export const GUEST_DISPLAY_NAME = 'Guest';

// ---------- Fairness engine (Section 11.2) ----------
export const FORMULA_VERSION = '1.0';
export const URGENCY_WINDOW_DAYS = 14;
export const FAIRNESS_CAP_HOURS = 20;
export const FAIRNESS_LOOKBACK_DAYS = 30;
export const STAGE_WEIGHTS = { idea: 0.3, prototype: 0.7, final: 1.0 };
export const W_URGENCY = 0.5;
export const W_FAIRNESS = 0.3;
export const W_STAGE = 0.2;
/** Decimal places used when displaying scores. */
export const SCORE_DECIMALS = 2;

// ---------- Utilisation (Section 12) ----------
export const UTIL_QUIET = 0.2;
export const UTIL_BUSY = 0.7;
export const UTILISATION_LABELS = { quiet: 'Quiet', moderate: 'Moderate', busy: 'Busy' };

// ---------- Caching and UI ----------
export const INVENTORY_CACHE_MS = 300_000;
export const SEARCH_DEBOUNCE_MS = 250;
export const MAX_SEARCH_RESULTS = 8;

// ---------- AI agent (Section 13) ----------
/**
 * Single place for the model name: a current Flash-class model. Overridable at build time with
 * VITE_AI_MODEL_NAME so a model retirement needs no code change.
 */
export const AI_MODEL_NAME = import.meta.env?.VITE_AI_MODEL_NAME || 'gemini-2.5-flash';
export const AI_TEMPERATURE = 0.2;
export const AI_MAX_OUTPUT_TOKENS = 1024;
export const AI_RECOMMEND_MAX_OUTPUT_TOKENS = 1024;
export const AI_EXPLAIN_MAX_OUTPUT_TOKENS = 400;
/** AI explanations longer than this are discarded in favour of the template. */
export const MAX_EXPLANATION_CHARS = 900;
export const MAX_MESSAGES_PER_MINUTE = 10;
export const RATE_LIMIT_WINDOW_MS = 60_000;
export const MAX_TOOL_ROUNDS = 6;
export const MAX_RECOMMENDED_ITEMS = 8;
export const MAX_FACULTY_NAME = 80;
export const DEFAULT_PLAN_WEEKS = 2;
/** Keyword search (recommendation fallback): points per word found in each field. */
export const SEARCH_WEIGHTS = { name: 3, tags: 2, text: 1 };
export const MIN_SEARCH_WORD_LENGTH = 3;

// ---------- App Check (optional) ----------
const UNSET_ENV_VALUES = ['', 'undefined', 'null'];
const envString = (value) => {
  const text = typeof value === 'string' ? value.trim() : '';
  return UNSET_ENV_VALUES.includes(text.toLowerCase()) ? '' : text;
};

/**
 * PURE: decides whether App Check is used, from build-time env values. App Check is enabled only
 * when VITE_RECAPTCHA_SITE_KEY is a non-empty string; otherwise initializeAppCheck must not run,
 * no debug token is set and AI Logic calls are sent without App Check tokens.
 * The debug token is used only with App Check enabled, in development, when non-empty.
 * @param {Record<string, unknown>} env Usually `import.meta.env`.
 * @returns {{ enabled: boolean, siteKey: string, debugToken: string | null }}
 */
export function resolveAppCheckConfig(env) {
  const siteKey = envString(env?.VITE_RECAPTCHA_SITE_KEY);
  const enabled = siteKey.length > 0;
  const debugToken = envString(env?.VITE_APPCHECK_DEBUG_TOKEN);
  return {
    enabled,
    siteKey,
    debugToken: enabled && env?.DEV === true && debugToken ? debugToken : null,
  };
}

// ---------- AI retries ----------
/** Retries after the first failed AI call (so at most AI_MAX_RETRIES + 1 attempts). */
export const AI_MAX_RETRIES = 2;
/** Wait before each retry: exponential backoff, 1 s then 3 s. */
export const AI_RETRY_DELAYS_MS = [1000, 3000];
/** Only overload and transient server errors are retried; other 4xx errors never are. */
export const AI_RETRYABLE_STATUSES = [429, 500, 503];
