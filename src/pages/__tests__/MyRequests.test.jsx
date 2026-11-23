import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import MyRequests from '../MyRequests.jsx';
import { Route, renderRoutes } from '../../testUtils.jsx';
import { loadMyProjects, loadMyRequests } from '../../lib/requests.js';
import { REQUEST } from '../../components/__tests__/fixtures.js';

vi.mock('../../lib/firebase.js', () => ({ db: {}, auth: {} }));
vi.mock('../../lib/requests.js', () => ({ loadMyProjects: vi.fn(), loadMyRequests: vi.fn() }));

describe('MyRequests', () => {
  it('shows projects, request status, faculty comments and alternatives', async () => {
    loadMyProjects.mockResolvedValue([
      {
        id: 'p1',
        title: 'Radar signal analyser',
        deadline: '2026-11-26',
        stage: 'final',
        facultyGuideName: 'Dr. Anil Mehta',
      },
    ]);
    loadMyRequests.mockResolvedValue([
      {
        ...REQUEST,
        status: 'conflict_lost',
        alternatives: {
          sessions: [{ date: '2026-11-25', startHour: 13, endHour: 15 }],
          substitutions: [],
          complete: true,
        },
      },
      { ...REQUEST, id: 'r2', status: 'rejected', facultyComment: 'Please use Friday.' },
    ]);
    const { container } = renderRoutes(<Route path="/" element={<MyRequests />} />);
    expect(await screen.findByText('Not allocated')).toBeInTheDocument();
    expect(screen.getByText('Rejected')).toBeInTheDocument();
    expect(screen.getByText('Please use Friday.')).toBeInTheDocument();
    expect(screen.getByText('Wed 25 Nov, 13:00–15:00')).toBeInTheDocument();
    expect(screen.getByText(/Guide Dr. Anil Mehta/)).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('shows empty states with next steps', async () => {
    loadMyProjects.mockResolvedValue([]);
    loadMyRequests.mockResolvedValue([]);
    renderRoutes(<Route path="/" element={<MyRequests />} />);
    expect(await screen.findByText('No projects yet')).toBeInTheDocument();
    expect(screen.getByText('No requests yet')).toBeInTheDocument();
  });
});
