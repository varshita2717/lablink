import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import Chat from '../Chat.jsx';
import { AgentContext } from '../../context/AgentContext.jsx';
import { Route, renderRoutes } from '../../testUtils.jsx';

vi.mock('../../lib/firebase.js', () => ({ db: {}, auth: {}, app: {}, appCheck: null }));

function renderChat(agent) {
  const value = {
    messages: [],
    pending: false,
    error: null,
    send: vi.fn(),
    confirmCard: vi.fn(),
    cancelCard: vi.fn(),
    ...agent,
  };
  const utils = renderRoutes(
    <Route
      path="/"
      element={
        <AgentContext.Provider value={value}>
          <Chat />
        </AgentContext.Provider>
      }
    />,
  );
  return { ...utils, value };
}

describe('Chat page', () => {
  it('has a labelled polite log, prompt chips and no axe violations', async () => {
    const user = userEvent.setup();
    const { container, value } = renderChat();
    const log = screen.getByRole('log', { name: 'Conversation' });
    expect(log).toHaveAttribute('aria-live', 'polite');
    await user.click(screen.getByRole('button', { name: /heat an acid/ }));
    expect(value.send).toHaveBeenCalledWith(expect.stringContaining('heat an acid'));
    expect(await axe(container)).toHaveNoViolations();
  });

  it('shows messages and cards, and "Assistant is typing" while pending', async () => {
    const { container } = renderChat({
      pending: true,
      messages: [
        { id: '1', role: 'user', text: 'Register my project' },
        {
          id: '2',
          role: 'card',
          card: {
            type: 'projectDraft',
            status: 'open',
            data: {
              title: 'Acid Study',
              description: '',
              deadline: '2026-12-05',
              stage: 'idea',
              facultyGuideName: 'Dr. Kavita Rao',
            },
          },
        },
        { id: '3', role: 'assistant', text: 'Please confirm the project.' },
      ],
    });
    expect(screen.getByText('Register my project')).toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'New project: Acid Study' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Assistant is typing');
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
    expect(screen.queryByRole('list', { name: 'Suggested prompts' })).not.toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('announces "The assistant is busy, retrying…" while retrying', () => {
    renderChat({
      pending: true,
      retrying: true,
      messages: [{ id: '1', role: 'user', text: 'hi' }],
    });
    expect(screen.getByRole('status')).toHaveTextContent('The assistant is busy, retrying…');
  });

  it('shows a friendly fallback with a Catalogue link when AI is unavailable', () => {
    renderChat({ error: { code: 'AI_UNAVAILABLE' } });
    expect(screen.getByRole('alert')).toHaveTextContent('The assistant is unavailable right now');
    expect(screen.getByRole('link', { name: 'Open the catalogue' })).toHaveAttribute(
      'href',
      '/catalogue',
    );
  });

  it('shows the rate-limit message', () => {
    renderChat({ error: { message: 'You are sending messages too quickly.' } });
    expect(screen.getByRole('alert')).toHaveTextContent('too quickly');
  });
});
