// Chat session and tool loop (SPEC 13.1). firebase/ai is imported dynamically on first use.
import { app, appCheck } from '../firebase.js';
import {
  AI_MAX_OUTPUT_TOKENS,
  AI_MODEL_NAME,
  AI_MAX_RETRIES,
  AI_RECOMMEND_MAX_OUTPUT_TOKENS,
  AI_RETRY_DELAYS_MS,
  AI_RETRYABLE_STATUSES,
  AI_TEMPERATURE,
  MAX_TOOL_ROUNDS,
} from '../config.js';
import { AppError, ERROR_CODES } from '../errors.js';
import { validateChatInput } from '../validate.js';
import { hoursByDate, loadAvailability, loadConfirmedBookings } from '../booking.js';
import { buildSubstitutes, loadActiveEquipment, loadExperiments } from '../inventory.js';
import { loadMyProjects } from '../requests.js';
import { loadFaculty } from '../users.js';
import { RECOMMEND_SCHEMA, buildRecommendPrompt, buildSystemPrompt } from './prompts.js';
import { createToolRunner, toolDeclarationsFor } from './tools.js';

export const TOOL_ROUNDS_EXCEEDED_TEXT =
  'Sorry, I could not finish that. Please try a shorter or more specific request.';

let aiPromise = null;

/**
 * HTTP status of a failed AI call: Firebase AI Logic puts it in `customErrorData.status`; the
 * message ("[503 Service Unavailable]") is used as a fallback.
 * @param {unknown} error
 * @returns {number | null}
 */
export function aiErrorStatus(error) {
  const status = error?.customErrorData?.status ?? error?.status;
  if (Number.isInteger(status)) return status;
  const match = /\[(\d{3})\b/.exec(String(error?.message ?? ''));
  return match ? Number(match[1]) : null;
}

/**
 * PURE: true only for retryable AI failures (429, 500, 503). Validation and auth errors (other
 * 4xx), errors without a status and app errors are never retried.
 * @param {unknown} error
 * @returns {boolean}
 */
export function isRetryableAIError(error) {
  return AI_RETRYABLE_STATUSES.includes(aiErrorStatus(error));
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Runs an AI call, retrying retryable failures up to AI_MAX_RETRIES times with backoff.
 * @param {() => Promise<any>} call
 * @param {{ onRetry?: (attempt: number, delayMs: number) => void,
 *           sleep?: (ms: number) => Promise<void> }} [options]
 * @returns {Promise<any>} The call's result.
 * @throws The last error once retries are exhausted, or any non-retryable error immediately.
 */
export async function withRetry(call, { onRetry, sleep = wait } = {}) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await call();
    } catch (error) {
      if (attempt >= AI_MAX_RETRIES || !isRetryableAIError(error)) throw error;
      const delay = AI_RETRY_DELAYS_MS[Math.min(attempt, AI_RETRY_DELAYS_MS.length - 1)];
      onRetry?.(attempt + 1, delay);
      await sleep(delay);
    }
  }
}

/** Loads firebase/ai once and creates the AI Logic client (Gemini Developer API backend). */
function loadAI() {
  aiPromise ??= import('firebase/ai')
    .then((mod) => ({
      mod,
      ai: mod.getAI(app, {
        backend: new mod.GoogleAIBackend(),
        // Limited-use App Check tokens only when App Check was initialised. Without it the
        // App Check component does not exist and requests carry no App Check header.
        useLimitedUseAppCheckTokens: Boolean(appCheck),
      }),
    }))
    .catch((error) => {
      aiPromise = null;
      throw error;
    });
  return aiPromise;
}

/** The separate JSON-mode call for recommend_equipment (SPEC 13.3). */
async function generateRecommendationJson(description, equipment, experiments, retry = {}) {
  const { mod, ai } = await loadAI();
  const model = mod.getGenerativeModel(ai, {
    model: AI_MODEL_NAME,
    generationConfig: {
      temperature: AI_TEMPERATURE,
      maxOutputTokens: AI_RECOMMEND_MAX_OUTPUT_TOKENS,
      responseMimeType: 'application/json',
      responseSchema: RECOMMEND_SCHEMA,
    },
  });
  const prompt = buildRecommendPrompt(description, equipment, experiments);
  const result = await withRetry(() => model.generateContent(prompt), retry);
  return result.response.text();
}

/**
 * One plain-text generation (used for the allocation explanation), with the same retry policy.
 * @param {string} prompt
 * @param {{ maxOutputTokens: number, onRetry?: (attempt: number, delayMs: number) => void }} options
 * @returns {Promise<string>} The model's text.
 * @throws The last AI error once retries are exhausted.
 */
export async function generateText(prompt, { maxOutputTokens, onRetry } = {}) {
  const { mod, ai } = await loadAI();
  const model = mod.getGenerativeModel(ai, {
    model: AI_MODEL_NAME,
    generationConfig: { temperature: AI_TEMPERATURE, maxOutputTokens },
  });
  const result = await withRetry(() => model.generateContent(prompt), { onRetry });
  return result.response.text();
}

const DEFAULT_DEPS = {
  loadActiveEquipment,
  loadExperiments,
  loadAvailability,
  loadConfirmedBookings,
  loadMyProjects,
  loadFaculty,
  buildSubstitutes,
  hoursByDate,
  generateRecommendationJson,
};

/**
 * Runs one user turn: send, then while the model calls functions (up to `maxRounds` rounds),
 * execute them and send the results back.
 * @param {{ chat: { sendMessage: (request: unknown) => Promise<object> }, message: string,
 *           execute: (name: string, args: unknown) => Promise<object>, maxRounds?: number }} input
 * @returns {Promise<{ text: string, rounds: number }>}
 * @throws Whatever `chat.sendMessage` throws.
 */
export async function runToolLoop({ chat, message, execute, maxRounds = MAX_TOOL_ROUNDS }) {
  let result = await chat.sendMessage(message);
  for (let round = 0; ; round += 1) {
    const calls = result.response.functionCalls?.() ?? [];
    if (calls.length === 0) return { text: result.response.text(), rounds: round };
    if (round >= maxRounds) return { text: TOOL_ROUNDS_EXCEEDED_TEXT, rounds: round };
    const parts = [];
    for (const call of calls) {
      const response = await execute(call.name, call.args);
      parts.push({ functionResponse: { name: call.name, response } });
    }
    result = await chat.sendMessage(parts);
  }
}

/**
 * Creates a chat session for one user and role. Nothing is loaded until the first message.
 * @param {{ user: { uid: string, name: string, role: string }, today: string,
 *           plans: Map<string, object>, onCard: (card: object) => void,
 *           onRetry?: (attempt: number, delayMs: number) => void, deps?: object }} options
 *   `onRetry` is called before each automatic retry of a busy or overloaded model.
 * @returns {{ send: (text: string) => Promise<string> }}
 */
export function createAgentSession({ user, today, plans, onCard, onRetry, deps = DEFAULT_DEPS }) {
  const retry = { onRetry, sleep: deps.sleep };
  const runner = createToolRunner({
    user,
    today,
    plans,
    deps: {
      ...deps,
      generateRecommendationJson: (text, equipment, experiments) =>
        deps.generateRecommendationJson(text, equipment, experiments, retry),
    },
  });
  let chatPromise = null;

  const startChat = async () => {
    const { mod, ai } = await loadAI();
    const model = mod.getGenerativeModel(ai, {
      model: AI_MODEL_NAME,
      systemInstruction: buildSystemPrompt({ today, name: user.name, role: user.role }),
      tools: toolDeclarationsFor(user.role),
      generationConfig: { temperature: AI_TEMPERATURE, maxOutputTokens: AI_MAX_OUTPUT_TOKENS },
    });
    return model.startChat();
  };

  return {
    /**
     * Sends one validated user message and returns the assistant's final text.
     * @throws {AppError} INVALID_INPUT for bad text; AI_UNAVAILABLE if the model cannot be reached.
     */
    async send(text) {
      const message = validateChatInput(text);
      runner.beginMessage();
      try {
        chatPromise ??= startChat();
        const chat = await chatPromise;
        // Transient 429/500/503 failures are retried with backoff before giving up.
        const retryingChat = {
          sendMessage: (request) => withRetry(() => chat.sendMessage(request), retry),
        };
        const { text: reply } = await runToolLoop({
          chat: retryingChat,
          message,
          execute: async (name, args) => {
            const { response, card } = await runner.run(name, args);
            if (card) onCard(card);
            return response;
          },
        });
        return reply;
      } catch (error) {
        chatPromise = null; // start a fresh session next time
        console.error('Assistant unavailable', error);
        throw new AppError(ERROR_CODES.AI_UNAVAILABLE, 'AI call failed');
      }
    },
  };
}
