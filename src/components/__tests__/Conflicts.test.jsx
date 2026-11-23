import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import RankingTable from '../RankingTable.jsx';
import ExplanationCard from '../ExplanationCard.jsx';
import ConflictGroup from '../ConflictGroup.jsx';
import ApprovalItem from '../ApprovalItem.jsx';
import { Route, renderRoutes } from '../../testUtils.jsx';
import { REQUEST, RESOLUTION } from './fixtures.js';
import {
  approveRequest,
  confirmAllocation,
  rejectRequest,
  resolveConflict,
} from '../../lib/requests.js';

vi.mock('../../lib/firebase.js', () => ({ db: {}, auth: {} }));
vi.mock('../../lib/agent/explain.js', () => ({
  templateExplanation: vi.fn(() => 'Template: Aarav Sharma is allocated with a score of 0.86.'),
  explainAllocation: vi.fn(async () => ({
    text: 'AI says Aarav Sharma wins with 0.86.',
    source: 'ai',
  })),
}));
vi.mock('../../lib/requests.js', () => ({
  approveRequest: vi.fn(),
  rejectRequest: vi.fn(),
  resolveConflict: vi.fn(),
  confirmAllocation: vi.fn(),
}));

describe('RankingTable', () => {
  it('shows rounded scores, the outcome in text and alternatives, with no axe violations', async () => {
    const { container } = render(<RankingTable resolution={RESOLUTION} caption="Ranking" />);
    const rows = screen.getAllByRole('row');
    expect(within(rows[1]).getByRole('rowheader')).toHaveTextContent('Aarav Sharma');
    expect(within(rows[1]).getByText('0.86')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Allocated')).toBeInTheDocument();
    expect(within(rows[2]).getByText('0.62')).toBeInTheDocument();
    expect(within(rows[2]).getByText('Not allocated')).toBeInTheDocument();
    expect(within(rows[2]).getByText('Wed 25 Nov, 10:00–12:00')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('ExplanationCard', () => {
  it('shows the template first, labelled as formula-generated, while the AI summary loads', () => {
    render(<ExplanationCard text="Template text." pending />);
    expect(screen.getByText(/Summary generated from the scoring formula/)).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Writing an AI summary…');
  });

  it('is a labelled article with a source note', async () => {
    const { container } = render(<ExplanationCard text="Aarav wins." source="ai" />);
    expect(screen.getByRole('article', { name: 'Why this allocation' })).toHaveTextContent(
      'Aarav wins.',
    );
    expect(screen.getByText(/ranking comes from the formula/)).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('ConflictGroup', () => {
  beforeEach(() => {
    resolveConflict.mockResolvedValue(RESOLUTION);
    confirmAllocation.mockResolvedValue({ approved: ['r1'], lost: ['r2'], failedWinners: [] });
  });

  it('resolves, explains and confirms the allocation', async () => {
    const user = userEvent.setup();
    const onConfirmed = vi.fn();
    const second = { ...REQUEST, id: 'r2', studentName: 'Rohan Das' };
    const { container } = renderRoutes(
      <Route
        path="/"
        element={
          <ConflictGroup
            index={0}
            requests={[REQUEST, second]}
            context={{}}
            onConfirmed={onConfirmed}
          />
        }
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Resolve conflict 1' }));
    expect(
      await screen.findByRole('table', { name: 'Ranking for conflict 1' }),
    ).toBeInTheDocument();
    const card = screen.getByRole('article', { name: 'Why this allocation' });
    // The AI summary replaces the template and is labelled as AI-generated.
    expect(
      await within(card).findByText('AI says Aarav Sharma wins with 0.86.'),
    ).toBeInTheDocument();
    expect(card).toHaveTextContent('AI-generated summary; the ranking comes from the formula');
    expect(await axe(container)).toHaveNoViolations();
    await user.click(screen.getByRole('button', { name: 'Confirm allocation for conflict 1' }));
    expect(confirmAllocation).toHaveBeenCalledWith(
      RESOLUTION,
      { r1: REQUEST, r2: second },
      expect.objectContaining({ uid: 'u1' }),
      expect.any(String),
    );
    expect(onConfirmed).toHaveBeenCalledWith(
      'Allocation confirmed. Booked: Aarav Sharma. Offered alternatives: Rohan Das.',
    );
  });
});

describe('ApprovalItem', () => {
  const renderItem = (props) =>
    renderRoutes(
      <Route
        path="/"
        element={
          <ApprovalItem request={REQUEST} inConflict={false} onDecided={vi.fn()} {...props} />
        }
      />,
    );

  beforeEach(() => {
    approveRequest.mockReset();
    rejectRequest.mockReset();
  });

  it('locks Approve for a conflicted request and links to Conflicts', async () => {
    const { container } = renderItem({ inConflict: true });
    expect(screen.getByRole('button', { name: /^Approve/ })).toBeDisabled();
    expect(screen.getByRole('link', { name: 'resolve on the Conflicts page' })).toHaveAttribute(
      'href',
      '/conflicts',
    );
    expect(screen.getByText('Your student')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('approves a non-conflicted request', async () => {
    const user = userEvent.setup();
    const onDecided = vi.fn();
    approveRequest.mockResolvedValue({ status: 'approved' });
    renderItem({ onDecided });
    await user.click(
      screen.getByRole('button', { name: 'Approve Aarav Sharma, Radar signal analyser' }),
    );
    expect(onDecided).toHaveBeenCalledWith(
      'Approved and booked: Aarav Sharma, Radar signal analyser.',
    );
  });

  it('tells faculty when approval failed because the slot was taken', async () => {
    const user = userEvent.setup();
    const onDecided = vi.fn();
    approveRequest.mockResolvedValue({ status: 'conflict_lost', alternatives: {} });
    renderItem({ onDecided });
    await user.click(screen.getByRole('button', { name: /^Approve/ }));
    expect(onDecided).toHaveBeenCalledWith(expect.stringContaining('the slots were taken'));
  });

  it('requires a comment to reject', async () => {
    const user = userEvent.setup();
    const onDecided = vi.fn();
    renderItem({ onDecided });
    await user.click(screen.getByRole('button', { name: /^Reject/ }));
    expect(screen.getByRole('alert')).toHaveTextContent('A comment is required');
    expect(rejectRequest).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText(/Comment/), 'Use the lab scope on Friday.');
    await user.click(screen.getByRole('button', { name: /^Reject/ }));
    expect(rejectRequest).toHaveBeenCalledWith(
      'r1',
      expect.objectContaining({ uid: 'u1' }),
      'Use the lab scope on Friday.',
    );
    expect(onDecided).toHaveBeenCalledWith('Rejected: Aarav Sharma, Radar signal analyser.');
  });
});
