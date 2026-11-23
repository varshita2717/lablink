import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import EquipmentDetail from '../EquipmentDetail.jsx';
import { Route, fakeAuth, renderRoutes } from '../../testUtils.jsx';
import { confirmPlan, createProject, loadMyProjects } from '../../lib/requests.js';
import { loadFaculty } from '../../lib/users.js';
import { loadActiveEquipment } from '../../lib/inventory.js';
import { bookPlan } from '../../lib/booking.js';
import { AppError, ERROR_CODES } from '../../lib/errors.js';

vi.mock('../../lib/firebase.js', () => ({ db: {}, auth: {} }));
vi.mock('../../lib/inventory.js', () => ({ loadActiveEquipment: vi.fn() }));
vi.mock('../../lib/requests.js', () => ({
  loadMyProjects: vi.fn(),
  confirmPlan: vi.fn(),
  createProject: vi.fn(),
}));
vi.mock('../../lib/users.js', () => ({ loadFaculty: vi.fn() }));
vi.mock('../../lib/dates.js', async (importOriginal) => ({
  ...(await importOriginal()),
  today: () => '2026-11-23',
}));
vi.mock('../../lib/booking.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    bookPlan: vi.fn(),
    loadAvailability: vi.fn(async (equipment, dates) =>
      actual.buildAvailability(equipment, dates, []),
    ),
  };
});

const MULTIMETER = {
  id: 'eq-multimeter',
  name: 'Multimeter',
  category: 'Measurement',
  description: 'Digital multimeter',
  labName: 'Embedded Systems Lab',
  department: 'ECE',
  quantity: 10,
  accessLevel: 'open',
  hazardLevel: 'none',
  safetyNote: '',
};
const MANTLE = {
  ...MULTIMETER,
  id: 'eq-heating-mantle',
  name: 'Heating mantle',
  quantity: 3,
  accessLevel: 'approval',
  hazardLevel: 'high',
  safetyNote: 'Faculty supervision required.',
};

const renderDetail = (id, auth) =>
  renderRoutes(
    <>
      <Route path="/equipment/:id" element={<EquipmentDetail />} />
      <Route path="/" element={<p>Chat home</p>} />
    </>,
    { path: `/equipment/${id}`, auth },
  );

describe('EquipmentDetail', () => {
  beforeEach(() => {
    loadActiveEquipment.mockResolvedValue([MULTIMETER, MANTLE]);
    loadMyProjects.mockResolvedValue([{ id: 'proj-1', title: 'Acid Reaction Study' }]);
    loadFaculty.mockResolvedValue([{ uid: 'seed-kavita', name: 'Dr. Kavita Rao' }]);
    confirmPlan.mockReset();
    createProject.mockReset();
    bookPlan.mockReset();
  });

  it('books an open item for the selected contiguous hours', async () => {
    const user = userEvent.setup();
    bookPlan.mockResolvedValue(['b1']);
    const { container } = renderDetail('eq-multimeter');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Multimeter' }),
    ).toBeInTheDocument();
    await waitFor(() => expect(document.title).toBe('Multimeter · LabLink'));
    await user.click(
      screen.getByRole('button', { name: 'Tue 24 Nov, 10:00 to 11:00, 10 of 10 free' }),
    );
    await user.click(
      screen.getByRole('button', { name: 'Tue 24 Nov, 11:00 to 12:00, 10 of 10 free' }),
    );
    expect(screen.getByText('Selected: Tue 24 Nov, 10:00–12:00')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
    await user.click(
      screen.getByRole('button', { name: 'Book Multimeter, Tue 24 Nov, 10:00–12:00' }),
    );
    expect(bookPlan).toHaveBeenCalledWith({
      user: expect.objectContaining({ uid: 'u1' }),
      entries: [{ equipment: MULTIMETER, date: '2026-11-24', startHour: 10, endHour: 12, qty: 1 }],
    });
    expect(await screen.findByText(/Booked 1 × Multimeter/)).toBeInTheDocument();
  });

  it('validates the units field', async () => {
    const user = userEvent.setup();
    renderDetail('eq-multimeter');
    const units = await screen.findByLabelText(/Units needed/);
    await user.clear(units);
    await user.type(units, '11');
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a whole number from 1 to 10.');
    expect(units).toHaveAttribute('aria-invalid', 'true');
  });

  it('shows a friendly error when the slot was just taken', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const user = userEvent.setup();
    bookPlan.mockRejectedValue(new AppError(ERROR_CODES.SLOT_FULL));
    renderDetail('eq-multimeter');
    await user.click(
      await screen.findByRole('button', { name: 'Tue 24 Nov, 10:00 to 11:00, 10 of 10 free' }),
    );
    await user.click(screen.getByRole('button', { name: /^Book Multimeter/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('That slot was just taken');
    vi.restoreAllMocks();
  });

  it('offers "Request this via chat" with a safety note for approval items', async () => {
    const user = userEvent.setup();
    const { container } = renderDetail('eq-heating-mantle');
    expect(await screen.findByRole('heading', { name: 'Safety note' })).toBeInTheDocument();
    expect(screen.getByText('Faculty supervision required.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Book/ })).not.toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
    await user.click(screen.getByRole('button', { name: 'Request this via chat' }));
    expect(screen.getByText('Chat home')).toBeInTheDocument();
  });

  it('shows a not-found state for unknown equipment', async () => {
    renderDetail('nope');
    expect(await screen.findByRole('heading', { name: 'Equipment not found' })).toBeInTheDocument();
  });

  describe('manual request for approval equipment', () => {
    const pickTwoHours = async (user) => {
      await user.click(
        await screen.findByRole('button', { name: 'Tue 24 Nov, 10:00 to 11:00, 3 of 3 free' }),
      );
      await user.click(
        screen.getByRole('button', { name: 'Tue 24 Nov, 11:00 to 12:00, 3 of 3 free' }),
      );
    };

    it('asks for the missing details before sending', async () => {
      const user = userEvent.setup();
      renderDetail('eq-heating-mantle');
      await user.click(
        await screen.findByRole('button', { name: 'Request approval for Heating mantle' }),
      );
      expect(screen.getByRole('alert')).toHaveTextContent('Select a time on the grid.');
      await pickTwoHours(user);
      await user.click(screen.getByRole('button', { name: 'Request approval for Heating mantle' }));
      expect(screen.getByRole('alert')).toHaveTextContent('Choose a project or create a new one.');
      expect(confirmPlan).not.toHaveBeenCalled();
    });

    it('sends the selected time for an existing project, with no axe violations', async () => {
      const user = userEvent.setup();
      confirmPlan.mockResolvedValue({ type: 'request', requestId: 'req-1' });
      const { container } = renderDetail('eq-heating-mantle');
      await pickTwoHours(user);
      await user.selectOptions(screen.getByLabelText('Project (required)'), 'proj-1');
      await user.type(screen.getByLabelText(/Why you need it/), 'Supervised heating study.');
      expect(await axe(container)).toHaveNoViolations();
      await user.click(screen.getByRole('button', { name: 'Request approval for Heating mantle' }));
      expect(confirmPlan).toHaveBeenCalledWith(
        {
          project: { id: 'proj-1' },
          items: [{ equipmentId: 'eq-heating-mantle', qty: 1 }],
          sessions: [{ date: '2026-11-24', startHour: 10, endHour: 12 }],
          justification: 'Supervised heating study.',
        },
        expect.objectContaining({ uid: 'u1' }),
      );
      expect(await screen.findByText(/sent for faculty approval/)).toHaveTextContent(
        'Request for Heating mantle on Tue 24 Nov, 10:00–12:00 sent for faculty approval.',
      );
      expect(screen.getByRole('link', { name: 'Track it in My requests' })).toHaveAttribute(
        'href',
        '/my-requests',
      );
    });

    it('creates a new project first when "New project…" is chosen', async () => {
      const user = userEvent.setup();
      createProject.mockResolvedValue('proj-new');
      confirmPlan.mockResolvedValue({ type: 'request', requestId: 'req-2' });
      renderDetail('eq-heating-mantle');
      await pickTwoHours(user);
      await user.selectOptions(screen.getByLabelText('Project (required)'), 'new');
      await user.type(screen.getByLabelText('Project title (required)'), 'Acid Study');
      await user.type(screen.getByLabelText('Deadline (required)'), '2026-12-05');
      await user.selectOptions(screen.getByLabelText('Faculty guide (required)'), 'seed-kavita');
      await user.type(screen.getByLabelText(/Why you need it/), 'Heating study.');
      await user.click(screen.getByRole('button', { name: 'Request approval for Heating mantle' }));
      expect(createProject).toHaveBeenCalledWith(
        expect.objectContaining({ uid: 'u1' }),
        {
          title: 'Acid Study',
          description: '',
          deadline: '2026-12-05',
          stage: 'prototype',
          facultyGuideUid: 'seed-kavita',
          facultyGuideName: 'Dr. Kavita Rao',
        },
        '2026-11-23',
      );
      expect(confirmPlan).toHaveBeenCalledWith(
        expect.objectContaining({ project: { id: 'proj-new' } }),
        expect.anything(),
      );
    });

    it('shows staff the grid without the request form', async () => {
      const auth = fakeAuth();
      auth.user.role = 'faculty';
      renderDetail('eq-heating-mantle', auth);
      expect(
        await screen.findByText('Only students can send access requests.'),
      ).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Request approval/ })).not.toBeInTheDocument();
    });
  });
});
