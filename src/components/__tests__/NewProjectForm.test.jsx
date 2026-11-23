import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import MyRequests from '../../pages/MyRequests.jsx';
import { Route, renderRoutes } from '../../testUtils.jsx';
import { createProject, loadMyProjects, loadMyRequests } from '../../lib/requests.js';
import { loadFaculty } from '../../lib/users.js';

vi.mock('../../lib/firebase.js', () => ({ db: {}, auth: {} }));
vi.mock('../../lib/requests.js', () => ({
  loadMyProjects: vi.fn(),
  loadMyRequests: vi.fn(),
  createProject: vi.fn(),
}));
vi.mock('../../lib/users.js', () => ({ loadFaculty: vi.fn() }));
vi.mock('../../lib/dates.js', async (importOriginal) => ({
  ...(await importOriginal()),
  today: () => '2026-11-23',
}));

const renderPage = () => renderRoutes(<Route path="/" element={<MyRequests />} />);

async function openForm(user) {
  await user.click(await screen.findByRole('button', { name: 'New project' }));
  return screen.findByLabelText(/Project title/);
}

describe('New project form (MyRequests)', () => {
  beforeEach(() => {
    loadMyProjects.mockResolvedValue([]);
    loadMyRequests.mockResolvedValue([]);
    loadFaculty.mockResolvedValue([
      { uid: 'seed-kavita', name: 'Dr. Kavita Rao' },
      { uid: 'seed-anil', name: 'Dr. Anil Mehta' },
    ]);
    createProject.mockReset();
  });

  it('creates the project through createProject, then confirms and refreshes', async () => {
    const user = userEvent.setup();
    createProject.mockResolvedValue('proj-1');
    renderPage();
    const button = await screen.findByRole('button', { name: 'New project' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    await user.type(await openForm(user), '  Acid Reaction Study ');
    expect(button).toHaveAttribute('aria-expanded', 'true');
    await user.type(screen.getByLabelText(/Description/), 'Heating an acid safely');
    await user.type(screen.getByLabelText('Deadline (required)'), '2026-12-05');
    await user.selectOptions(screen.getByLabelText('Stage (required)'), 'final');
    await user.selectOptions(screen.getByLabelText('Faculty guide (required)'), 'seed-kavita');
    await user.click(screen.getByRole('button', { name: 'Create project' }));
    expect(createProject).toHaveBeenCalledWith(
      expect.objectContaining({ uid: 'u1' }),
      {
        title: '  Acid Reaction Study ',
        description: 'Heating an acid safely',
        deadline: '2026-12-05',
        stage: 'final',
        facultyGuideUid: 'seed-kavita',
        facultyGuideName: 'Dr. Kavita Rao',
      },
      '2026-11-23',
    );
    const notice = await screen.findByText('Project created');
    await waitFor(() => expect(notice).toHaveFocus());
    expect(screen.queryByLabelText(/Project title/)).not.toBeInTheDocument();
    expect(loadMyProjects).toHaveBeenCalledTimes(2);
  });

  it('shows a linked, announced error for an empty title and focuses the first invalid field', async () => {
    const user = userEvent.setup();
    renderPage();
    await openForm(user);
    await user.click(screen.getByRole('button', { name: 'Create project' }));
    const title = screen.getByLabelText(/Project title/);
    expect(title).toHaveFocus();
    expect(title).toHaveAttribute('aria-invalid', 'true');
    const error = document.getElementById(title.getAttribute('aria-describedby'));
    expect(error).toHaveAttribute('role', 'alert');
    expect(error).toHaveTextContent('Title is required.');
    expect(screen.getByText('Choose a faculty guide.')).toBeInTheDocument();
    expect(createProject).not.toHaveBeenCalled();
  });

  it('rejects a deadline beyond 365 days', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(await openForm(user), 'Study');
    await user.type(screen.getByLabelText('Deadline (required)'), '2028-01-01');
    await user.selectOptions(screen.getByLabelText('Faculty guide (required)'), 'seed-anil');
    await user.click(screen.getByRole('button', { name: 'Create project' }));
    expect(screen.getByLabelText('Deadline (required)')).toHaveFocus();
    expect(
      screen.getByText(/Choose a deadline from tomorrow up to 365 days ahead/),
    ).toBeInTheDocument();
  });

  it('shows a friendly error when saving fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const user = userEvent.setup();
    createProject.mockRejectedValue({ code: 'permission-denied' });
    renderPage();
    await user.type(await openForm(user), 'Study');
    await user.type(screen.getByLabelText('Deadline (required)'), '2026-12-05');
    await user.selectOptions(screen.getByLabelText('Faculty guide (required)'), 'seed-anil');
    await user.click(screen.getByRole('button', { name: 'Create project' }));
    expect(await screen.findByText('You do not have permission to do that.')).toHaveAttribute(
      'role',
      'alert',
    );
    expect(screen.getByRole('button', { name: 'Create project' })).toBeEnabled();
    vi.restoreAllMocks();
  });

  it('Cancel collapses the form and returns focus to "New project"', async () => {
    const user = userEvent.setup();
    renderPage();
    await openForm(user);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByLabelText(/Project title/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New project' })).toHaveFocus();
  });

  it('has no axe violations with errors showing', async () => {
    const user = userEvent.setup();
    const { container } = renderPage();
    await openForm(user);
    await user.click(screen.getByRole('button', { name: 'Create project' }));
    expect(await axe(container)).toHaveNoViolations();
  });
});
