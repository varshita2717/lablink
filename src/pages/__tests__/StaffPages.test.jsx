import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import ApprovalQueue from '../ApprovalQueue.jsx';
import Conflicts from '../Conflicts.jsx';
import Admin from '../Admin.jsx';
import { Route, fakeAuth, renderRoutes } from '../../testUtils.jsx';
import { loadConflictContext } from '../../lib/requests.js';
import { seedDatabase } from '../../lib/seed.js';
import { REQUEST } from '../../components/__tests__/fixtures.js';

vi.mock('../../lib/firebase.js', () => ({ db: {}, auth: {}, app: {}, appCheck: null }));
vi.mock('../../lib/requests.js', () => ({
  loadConflictContext: vi.fn(),
  loadMyProjects: vi.fn(),
  approveRequest: vi.fn(),
  rejectRequest: vi.fn(),
  resolveConflict: vi.fn(),
  confirmAllocation: vi.fn(),
}));
vi.mock('../../lib/agent/explain.js', () => ({
  templateExplanation: vi.fn(() => 'Template'),
  explainAllocation: vi.fn(async () => ({ text: 'Template', source: 'template' })),
}));
vi.mock('../../lib/seed.js', () => ({ seedDatabase: vi.fn() }));

const SECOND = { ...REQUEST, id: 'r2', studentName: 'Rohan Das', projectTitle: 'Audio visualiser' };
const OTHER = {
  ...REQUEST,
  id: 'r3',
  studentName: 'Meera Iyer',
  projectTitle: 'ECG filter',
  facultyUid: 'x',
};
const CONTEXT = {
  pending: [REQUEST, SECOND, OTHER],
  equipment: [],
  equipmentById: {},
  availability: {},
  groups: [{ requestIds: ['r1', 'r2'], conflictedKeys: ['eq-oscilloscope|2026-11-24|10'] }],
};
const faculty = () => {
  const auth = fakeAuth();
  auth.user.role = 'faculty';
  return auth;
};

describe('staff and admin pages (axe)', () => {
  beforeEach(() => {
    loadConflictContext.mockResolvedValue(CONTEXT);
  });

  it('ApprovalQueue: conflict lock and decisions, no axe violations', async () => {
    const { container } = renderRoutes(<Route path="/" element={<ApprovalQueue />} />, {
      auth: faculty(),
    });
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Approval queue' }),
    ).toBeInTheDocument();
    expect(screen.getAllByText('resolve on the Conflicts page')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Approve Meera Iyer, ECG filter' })).toBeEnabled();
    expect(
      screen.getByRole('button', { name: 'Approve Aarav Sharma, Radar signal analyser' }),
    ).toBeDisabled();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('ApprovalQueue: empty state, no axe violations', async () => {
    loadConflictContext.mockResolvedValue({ ...CONTEXT, pending: [], groups: [] });
    const { container } = renderRoutes(<Route path="/" element={<ApprovalQueue />} />, {
      auth: faculty(),
    });
    expect(await screen.findByText('No pending requests')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('Conflicts: groups with Resolve buttons, no axe violations', async () => {
    const { container } = renderRoutes(<Route path="/" element={<Conflicts />} />, {
      auth: faculty(),
    });
    expect(await screen.findByRole('button', { name: 'Resolve conflict 1' })).toBeInTheDocument();
    expect(screen.getByText(/Conflict 1: Digital Oscilloscope/)).toBeInTheDocument();
    expect(document.title).toBe('Conflicts · LabLink');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('Conflicts: empty state, no axe violations', async () => {
    loadConflictContext.mockResolvedValue({ ...CONTEXT, groups: [] });
    const { container } = renderRoutes(<Route path="/" element={<Conflicts />} />, {
      auth: faculty(),
    });
    expect(await screen.findByText('No conflicts right now')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('Admin: seed button and result, no axe violations', async () => {
    seedDatabase.mockResolvedValue({ seeded: true, message: 'Seeded 18 equipment items.' });
    const user = userEvent.setup();
    const auth = fakeAuth();
    auth.user.role = 'admin';
    const { container } = renderRoutes(<Route path="/" element={<Admin />} />, { auth });
    await user.click(screen.getByRole('button', { name: 'Seed demo data' }));
    expect(await screen.findByText('Seeded 18 equipment items.')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });
});
