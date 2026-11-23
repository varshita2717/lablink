import { createContext, useCallback, useMemo, useRef, useState } from 'react';
import useAuth from '../hooks/useAuth.js';
import useRateLimit from '../hooks/useRateLimit.js';
import { createAgentSession } from '../lib/agent/agent.js';
import { confirmPlan, createProject } from '../lib/requests.js';
import { MAX_MESSAGES_PER_MINUTE, RATE_LIMIT_WINDOW_MS } from '../lib/config.js';
import { ERROR_CODES } from '../lib/errors.js';
import { today } from '../lib/dates.js';
import { friendlyError } from '../lib/format.js';

/** @type {import('react').Context<object | null>} */
export const AgentContext = createContext(null);

export const RATE_LIMIT_TEXT =
  'You are sending messages too quickly. Please wait a minute and try again.';

let nextId = 0;
const newId = () => `m${(nextId += 1)}`;

/**
 * Chat state in memory only: messages, cards and plans (by planId). A new session starts, and
 * everything is cleared, whenever the signed-in user or their role changes.
 */
export default function AgentProvider({ children }) {
  const { user } = useAuth();
  const sessionKey = user ? `${user.uid}:${user.role}` : '';
  const [state, setState] = useState({
    key: sessionKey,
    messages: [],
    pending: false,
    retrying: false,
    error: null,
  });
  const sessionRef = useRef({ key: null, session: null });
  const tryConsume = useRateLimit(MAX_MESSAGES_PER_MINUTE, RATE_LIMIT_WINDOW_MS);

  // Reset during render when the user or role changes (React's "adjust state on prop change").
  if (state.key !== sessionKey) {
    setState({ key: sessionKey, messages: [], pending: false, retrying: false, error: null });
  }

  const append = useCallback((message) => {
    setState((s) => ({ ...s, messages: [...s.messages, { id: newId(), ...message }] }));
  }, []);

  const getSession = useCallback(() => {
    if (sessionRef.current.key !== sessionKey) {
      sessionRef.current = {
        key: sessionKey,
        session: createAgentSession({
          user,
          today: today(),
          plans: new Map(),
          onCard: (card) => append({ role: 'card', card: { ...card, status: 'open' } }),
          onRetry: () => setState((s) => ({ ...s, retrying: true })),
        }),
      };
    }
    return sessionRef.current.session;
  }, [sessionKey, user, append]);

  /** Sends text to the agent. `bypassLimit` is for Confirm results, which the user did not type. */
  const send = useCallback(
    async (text, { bypassLimit = false, focus = false } = {}) => {
      if (!bypassLimit && !tryConsume()) {
        setState((s) => ({ ...s, error: { message: RATE_LIMIT_TEXT } }));
        return;
      }
      append({ role: 'user', text, focus });
      setState((s) => ({ ...s, pending: true, retrying: false, error: null }));
      try {
        const reply = await getSession().send(text);
        append({ role: 'assistant', text: reply });
        setState((s) => ({ ...s, pending: false, retrying: false }));
      } catch (error) {
        setState((s) => ({
          ...s,
          pending: false,
          retrying: false,
          error: { code: error.code ?? ERROR_CODES.AI_UNAVAILABLE },
        }));
      }
    },
    [append, getSession, tryConsume],
  );

  const setCardStatus = useCallback((id, status, cardError = null) => {
    setState((s) => ({
      ...s,
      messages: s.messages.map((m) =>
        m.id === id ? { ...m, card: { ...m.card, status, error: cardError } } : m,
      ),
    }));
  }, []);

  /** Runs a card's Confirm action, then posts the result into the chat (focused). */
  const confirmCard = useCallback(
    async (message) => {
      const { type, data } = message.card;
      setCardStatus(message.id, 'submitting');
      try {
        let result;
        if (type === 'projectDraft') {
          const projectId = await createProject(user, data, today());
          result = `✅ Project "${data.title}" created (projectId: ${projectId})`;
        } else {
          const outcome = await confirmPlan(data, user);
          result =
            outcome.type === 'request'
              ? `✅ Request for "${data.project.title}" submitted for faculty approval (requestId: ${outcome.requestId})`
              : `✅ Booked ${data.sessions.length} session(s) for "${data.project.title}"`;
        }
        setCardStatus(message.id, 'confirmed');
        await send(result, { bypassLimit: true, focus: true });
      } catch (error) {
        console.error('Confirm failed', error);
        setCardStatus(message.id, 'open', friendlyError(error));
        await send(`⚠️ Could not confirm: ${friendlyError(error)}`, {
          bypassLimit: true,
          focus: true,
        });
      }
    },
    [send, setCardStatus, user],
  );

  const cancelCard = useCallback(
    (message) => setCardStatus(message.id, 'cancelled'),
    [setCardStatus],
  );

  const value = useMemo(
    () => ({
      messages: state.messages,
      pending: state.pending,
      retrying: state.retrying,
      error: state.error,
      send,
      confirmCard,
      cancelCard,
    }),
    [state, send, confirmCard, cancelCard],
  );
  return <AgentContext.Provider value={value}>{children}</AgentContext.Provider>;
}
