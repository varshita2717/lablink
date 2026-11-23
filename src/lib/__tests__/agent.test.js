import { describe, expect, it, vi } from 'vitest';
import {
  TOOL_ROUNDS_EXCEEDED_TEXT,
  aiErrorStatus,
  createAgentSession,
  isRetryableAIError,
  runToolLoop,
  withRetry,
} from '../agent/agent.js';
import { AppError } from '../errors.js';
import { ERROR_CODES } from '../errors.js';

vi.mock('../firebase.js', () => ({ db: {}, app: {}, appCheck: null }));
const getAI = vi.fn(() => ({}));
vi.mock('firebase/ai', () => ({
  GoogleAIBackend: class {},
  getAI: (...args) => getAI(...args),
  getGenerativeModel: () => {
    throw new Error('App Check token rejected');
  },
}));

const reply = (calls, text = '') => ({
  response: { functionCalls: () => calls, text: () => text },
});

describe('runToolLoop', () => {
  it('runs function calls, sends results back and returns the final text', async () => {
    const chat = {
      sendMessage: vi
        .fn()
        .mockResolvedValueOnce(reply([{ name: 'find_slots', args: { a: 1 } }]))
        .mockResolvedValueOnce(reply(undefined, 'Here is your plan.')),
    };
    const execute = vi.fn(async () => ({ planId: 'plan-1' }));
    const result = await runToolLoop({ chat, message: 'I need 3 hours', execute });
    expect(result).toEqual({ text: 'Here is your plan.', rounds: 1 });
    expect(execute).toHaveBeenCalledWith('find_slots', { a: 1 });
    expect(chat.sendMessage).toHaveBeenNthCalledWith(1, 'I need 3 hours');
    expect(chat.sendMessage).toHaveBeenNthCalledWith(2, [
      { functionResponse: { name: 'find_slots', response: { planId: 'plan-1' } } },
    ]);
  });

  it('stops after the maximum number of tool rounds', async () => {
    const chat = { sendMessage: vi.fn(async () => reply([{ name: 'loop', args: {} }])) };
    const result = await runToolLoop({
      chat,
      message: 'hi',
      execute: async () => ({}),
      maxRounds: 6,
    });
    expect(result).toEqual({ text: TOOL_ROUNDS_EXCEEDED_TEXT, rounds: 6 });
    expect(chat.sendMessage).toHaveBeenCalledTimes(7);
  });
});

describe('createAgentSession', () => {
  const session = () =>
    createAgentSession({
      user: { uid: 'u1', name: 'Asha', role: 'student' },
      today: '2026-11-23',
      plans: new Map(),
      onCard: vi.fn(),
    });

  it('validates the message before calling the model', async () => {
    await expect(session().send('   ')).rejects.toMatchObject({ code: ERROR_CODES.INVALID_INPUT });
    await expect(session().send('x'.repeat(1001))).rejects.toMatchObject({
      code: ERROR_CODES.INVALID_INPUT,
    });
  });

  it('turns network, App Check or quota failures into AI_UNAVAILABLE', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(session().send('hello')).rejects.toMatchObject({
      code: ERROR_CODES.AI_UNAVAILABLE,
    });
    vi.restoreAllMocks();
  });
});

const aiError = (status) =>
  Object.assign(new Error(`AI: Error fetching [${status} Status] (AI/fetch-error)`), {
    code: 'fetch-error',
    customErrorData: { status },
  });

describe('isRetryableAIError', () => {
  it.each([429, 500, 503])('retries %i', (status) => {
    expect(isRetryableAIError(aiError(status))).toBe(true);
  });

  it.each([400, 401, 403, 404, 422, 501, 502])('never retries %i', (status) => {
    expect(isRetryableAIError(aiError(status))).toBe(false);
  });

  it('never retries errors without a status or app validation errors', () => {
    expect(isRetryableAIError(new TypeError('Failed to fetch'))).toBe(false);
    expect(isRetryableAIError(new AppError(ERROR_CODES.INVALID_INPUT))).toBe(false);
    expect(isRetryableAIError(null)).toBe(false);
  });

  it('reads the status from the message when customErrorData is missing', () => {
    const error = new Error('AI: Error fetching from url: [503 Service Unavailable] high demand');
    expect(aiErrorStatus(error)).toBe(503);
    expect(isRetryableAIError(error)).toBe(true);
  });
});

describe('withRetry', () => {
  it('retries twice with 1 s then 3 s backoff, reporting each retry', async () => {
    const sleep = vi.fn(async () => {});
    const onRetry = vi.fn();
    const call = vi
      .fn()
      .mockRejectedValueOnce(aiError(503))
      .mockRejectedValueOnce(aiError(429))
      .mockResolvedValueOnce('ok');
    await expect(withRetry(call, { onRetry, sleep })).resolves.toBe('ok');
    expect(call).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls).toEqual([[1000], [3000]]);
    expect(onRetry.mock.calls).toEqual([
      [1, 1000],
      [2, 3000],
    ]);
  });

  it('gives up after 2 retries and rethrows the last error', async () => {
    const sleep = vi.fn(async () => {});
    const call = vi.fn().mockRejectedValue(aiError(500));
    await expect(withRetry(call, { sleep })).rejects.toMatchObject({
      customErrorData: { status: 500 },
    });
    expect(call).toHaveBeenCalledTimes(3);
  });

  it('does not retry a 400 validation error', async () => {
    const sleep = vi.fn(async () => {});
    const call = vi.fn().mockRejectedValue(aiError(400));
    await expect(withRetry(call, { sleep })).rejects.toMatchObject({
      customErrorData: { status: 400 },
    });
    expect(call).toHaveBeenCalledOnce();
    expect(sleep).not.toHaveBeenCalled();
  });
});
