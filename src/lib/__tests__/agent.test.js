import { describe, expect, it, vi } from 'vitest';
import { TOOL_ROUNDS_EXCEEDED_TEXT, createAgentSession, runToolLoop } from '../agent/agent.js';
import { ERROR_CODES } from '../errors.js';

vi.mock('../firebase.js', () => ({ db: {}, app: {}, appCheck: null }));
vi.mock('firebase/ai', () => ({
  GoogleAIBackend: class {},
  getAI: () => ({}),
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
