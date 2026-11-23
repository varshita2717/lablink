import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { axe } from 'jest-axe';
import ChatMessage from '../ChatMessage.jsx';
import ChatInput from '../ChatInput.jsx';
import PlanCard from '../PlanCard.jsx';
import ProjectDraftCard from '../ProjectDraftCard.jsx';
import EquipmentListCard from '../EquipmentListCard.jsx';
import PromptChips, { DEMO_PROMPTS } from '../PromptChips.jsx';

const XSS = '<img src=x onerror=alert(1)>';

describe('ChatMessage', () => {
  it('renders model and user text as literal text, never HTML (XSS)', () => {
    const { container } = render(<ChatMessage speaker="assistant" text={XSS} />);
    expect(screen.getByText(XSS)).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
    expect(container).toHaveTextContent(XSS);
  });

  it('keeps line breaks (pre-wrap) and names the speaker for screen readers', () => {
    render(<ChatMessage speaker="user" text={'line one\nline two'} />);
    expect(screen.getByText('You:')).toHaveClass('sr-only');
    expect(screen.getByText(/line one/).closest('div')).toHaveClass('whitespace-pre-wrap');
  });

  it('can take focus (used after Confirm) and has no axe violations', async () => {
    const { container } = render(<ChatMessage speaker="user" text="✅ Project created" focus />);
    expect(screen.getByText(/Project created/).closest('div')).toHaveFocus();
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('ChatInput', () => {
  it('sends on Enter, adds a new line on Shift+Enter, and labels the controls', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} disabled={false} />);
    const box = screen.getByLabelText(/Message the assistant/);
    await user.type(box, 'first{Shift>}{Enter}{/Shift}second');
    expect(box).toHaveValue('first\nsecond');
    await user.type(box, '{Enter}');
    expect(onSend).toHaveBeenCalledWith('first\nsecond');
    expect(box).toHaveValue('');
  });

  it('disables sending while a reply is pending or the box is empty', () => {
    const { rerender } = render(<ChatInput onSend={vi.fn()} disabled={false} />);
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
    rerender(<ChatInput onSend={vi.fn()} disabled initialValue="hello" />);
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
  });

  it('starts with a prefilled message', () => {
    render(<ChatInput onSend={vi.fn()} disabled={false} initialValue="Request the mantle" />);
    expect(screen.getByLabelText(/Message the assistant/)).toHaveValue('Request the mantle');
  });
});

describe('PromptChips', () => {
  it('offers the three demo prompts as buttons', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<PromptChips onPick={onPick} disabled={false} />);
    expect(screen.getAllByRole('button')).toHaveLength(3);
    await user.click(screen.getByRole('button', { name: DEMO_PROMPTS[2] }));
    expect(onPick).toHaveBeenCalledWith('I need 3 hours, 2 sessions a week.');
  });
});

const PLAN = {
  planId: 'plan-1',
  project: { id: 'p1', title: 'Acid Reaction Study' },
  items: [
    {
      equipmentId: 'eq-flask-500',
      name: 'Round-bottom flask 500 mL',
      qty: 1,
      accessLevel: 'open',
      hazardLevel: 'none',
    },
    {
      equipmentId: 'eq-heating-mantle',
      name: 'Heating mantle',
      qty: 1,
      accessLevel: 'approval',
      hazardLevel: 'high',
    },
  ],
  sessions: [
    { date: '2026-11-24', startHour: 10, endHour: 13 },
    { date: '2026-11-26', startHour: 10, endHour: 13 },
  ],
  substitutions: [
    {
      originalEquipmentId: 'eq-flask-250',
      originalName: 'Round-bottom flask 250 mL',
      replacement: { equipmentId: 'eq-flask-500', name: 'Round-bottom flask 500 mL' },
    },
  ],
  complete: true,
  requested: 2,
  found: 2,
  safetyNotes: ['Faculty supervision required.'],
  needsApproval: true,
  justification: 'Study',
};

describe('PlanCard', () => {
  it('shows the banner, sessions, the substitution in text and safety notes; no axe violations', async () => {
    const { container } = render(
      <PlanCard card={{ data: PLAN, status: 'open' }} onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(
      screen.getByRole('article', { name: 'Plan for Acid Reaction Study' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Needs faculty approval')).toBeInTheDocument();
    expect(screen.getByText('Tue 24 Nov, 10:00–13:00')).toBeInTheDocument();
    expect(
      screen.getByText(/Round-bottom flask 500 mL replaces Round-bottom flask 250 mL/),
    ).toBeInTheDocument();
    expect(screen.getByText('Faculty supervision required.')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has specific Confirm and Cancel names and disables them while submitting', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const { rerender } = render(
      <PlanCard card={{ data: PLAN, status: 'open' }} onConfirm={onConfirm} onCancel={onCancel} />,
    );
    await user.click(screen.getByRole('button', { name: 'Confirm plan for Acid Reaction Study' }));
    await user.click(screen.getByRole('button', { name: 'Cancel plan for Acid Reaction Study' }));
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onCancel).toHaveBeenCalledOnce();
    rerender(
      <PlanCard
        card={{ data: PLAN, status: 'submitting' }}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    expect(screen.getByRole('button', { name: 'Submitting…' })).toBeDisabled();
    rerender(
      <PlanCard
        card={{ data: PLAN, status: 'open', error: 'That slot was just taken.' }}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('That slot was just taken.');
    rerender(
      <PlanCard
        card={{ data: { ...PLAN, needsApproval: false }, status: 'confirmed' }}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    expect(screen.getByText('Books immediately')).toBeInTheDocument();
    expect(screen.getByText('Confirmed.')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('ProjectDraftCard', () => {
  it('shows the draft with named Confirm/Cancel and no axe violations', async () => {
    const data = {
      title: 'Acid Reaction Study',
      description: 'Heating',
      deadline: '2026-12-05',
      stage: 'prototype',
      facultyGuideName: 'Dr. Kavita Rao',
    };
    const { container } = render(
      <ProjectDraftCard card={{ data, status: 'open' }} onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(screen.getByText('Dr. Kavita Rao')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Confirm project Acid Reaction Study' }),
    ).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('EquipmentListCard', () => {
  it('shows availability, substitutes and safety in text; no axe violations', async () => {
    const data = {
      aiMatching: 'ok',
      matchedExperiment: { id: 'e', title: 'Heating an acid' },
      date: '2026-11-24',
      needsApproval: true,
      safetyNotes: ['Use the fume hood.'],
      items: [
        {
          equipmentId: 'eq-flask-250',
          name: 'Round-bottom flask 250 mL',
          qty: 1,
          role: 'Vessel',
          accessLevel: 'open',
          hazardLevel: 'none',
          availableTomorrow: false,
          substitutes: [{ equipmentId: 'eq-flask-500', name: 'Round-bottom flask 500 mL' }],
        },
      ],
    };
    const { container } = render(
      <MemoryRouter>
        <EquipmentListCard data={data} />
      </MemoryRouter>,
    );
    expect(screen.getByText('Not free on Tue 24 Nov')).toBeInTheDocument();
    expect(screen.getByText('Substitute available: Round-bottom flask 500 mL')).toBeInTheDocument();
    expect(screen.getByText('Needs faculty approval')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });
});
