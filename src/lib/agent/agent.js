// Chat session and tool loop (SPEC 13.1). firebase/ai is imported dynamically on first use.
import { app, appCheck } from '../firebase.js';
import {
  AI_MAX_OUTPUT_TOKENS,
  AI_MODEL_NAME,
  AI_RECOMMEND_MAX_OUTPUT_TOKENS,
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
async function generateRecommendationJson(description, equipment, experiments) {
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
  const result = await model.generateContent(
    buildRecommendPrompt(description, equipment, experiments),
  );
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
 *           plans: Map<string, object>, onCard: (card: object) => void, deps?: object }} options
 * @returns {{ send: (text: string) => Promise<string> }}
 */
export function createAgentSession({ user, today, plans, onCard, deps = DEFAULT_DEPS }) {
  const runner = createToolRunner({ user, today, plans, deps });
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
        const { text: reply } = await runToolLoop({
          chat,
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
