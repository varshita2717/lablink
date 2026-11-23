import { useEffect } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import AgentProvider, { RATE_LIMIT_TEXT } from '../AgentContext.jsx';
import { AuthContext } from '../AuthContext.jsx';
import useAgent from '../../hooks/useAgent.js';
import { createAgentSession } from '../../lib/agent/agent.js';
import { confirmPlan, createProject } from '../../lib/requests.js';
import { AppError, ERROR_CODES } from '../../lib/errors.js';
import { fakeAuth } from '../../testUtils.jsx';

vi.mock('../../lib/firebase.js', () => ({ db: {}, auth: {}, app: {}, appCheck: null }));
vi.mock('../../lib/agent/agent.js', () => ({ createAgentSession: vi.fn() }));
vi.mock('../../lib/requests.js', () => ({ confirmPlan: vi.fn(), createProject: vi.fn() }));

const probe = { current: null };
function Probe() {
  const value = useAgent();
  useEffect(() => {
    probe.current = value;
  });
  return null;
}

const tree = (auth) => (
  <AuthContext.Provider value={auth}>
    <AgentProvider>
      <Probe />
    </AgentProvider>
  </AuthContext.Provider>
);

describe('AgentProvider', () => {
  let sessionSend;
  let onCard;

  beforeEach(() => {
    sessionSend = vi.fn(async (text) => `Reply to: ${text}`);
    vi.mocked(createAgentSession).mockImplementation((options) => {
      onCard = options.onCard;
      return { send: sessionSend };
    });
  });

  it('adds the user message and the reply', async () => {
    render(tree(fakeAuth()));
    await act(() => probe.current.send('hello'));
    expect(probe.current.messages.map((m) => [m.role, m.text])).toEqual([
      ['user', 'hello'],
      ['assistant', 'Reply to: hello'],
    ]);
    expect(probe.current.pending).toBe(false);
  });

  it('limits users to 10 messages a minute', async () => {
    render(tree(fakeAuth()));
    for (let i = 0; i < 10; i += 1) await act(() => probe.current.send(`m${i}`));
    await act(() => probe.current.send('one too many'));
    expect(sessionSend).toHaveBeenCalledTimes(10);
    expect(probe.current.error).toEqual({ message: RATE_LIMIT_TEXT });
  });

  it('reports AI failures as AI_UNAVAILABLE', async () => {
    sessionSend.mockRejectedValue(new AppError(ERROR_CODES.AI_UNAVAILABLE));
    render(tree(fakeAuth()));
    await act(() => probe.current.send('hello'));
    expect(probe.current.error).toEqual({ code: ERROR_CODES.AI_UNAVAILABLE });
  });

  it('confirms a plan, then posts the focused result into the chat', async () => {
    vi.mocked(confirmPlan).mockResolvedValue({ type: 'request', requestId: 'req-1' });
    render(tree(fakeAuth()));
    await act(() => probe.current.send('plan it'));
    act(() => onCard({ type: 'plan', data: { project: { title: 'Acid Study' }, sessions: [] } }));
    await act(() =>
      probe.current.confirmCard(probe.current.messages.find((m) => m.role === 'card')),
    );
    expect(probe.current.messages.find((m) => m.role === 'card').card.status).toBe('confirmed');
    expect(probe.current.messages.find((m) => m.text?.startsWith('✅'))).toMatchObject({
      role: 'user',
      focus: true,
      text: '✅ Request for "Acid Study" submitted for faculty approval (requestId: req-1)',
    });
  });

  it('shows a confirm error in the card and posts it to the chat', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(createProject).mockRejectedValue(new AppError(ERROR_CODES.INVALID_INPUT));
    render(tree(fakeAuth()));
    await act(() => probe.current.send('register'));
    act(() => onCard({ type: 'projectDraft', data: { title: 'X' } }));
    await act(() =>
      probe.current.confirmCard(probe.current.messages.find((m) => m.role === 'card')),
    );
    const card = probe.current.messages.find((m) => m.role === 'card').card;
    expect(card.status).toBe('open');
    expect(card.error).toMatch(/not valid/);
    expect(probe.current.messages.some((m) => m.text?.startsWith('⚠️ Could not confirm'))).toBe(
      true,
    );
    vi.restoreAllMocks();
  });

  it('clears the conversation when the role changes', async () => {
    const auth = fakeAuth();
    const { rerender } = render(tree(auth));
    await act(() => probe.current.send('hello'));
    expect(probe.current.messages).toHaveLength(2);
    rerender(tree({ ...auth, user: { ...auth.user, role: 'faculty' } }));
    expect(probe.current.messages).toEqual([]);
    expect(screen.queryByText('hello')).not.toBeInTheDocument();
  });
});
