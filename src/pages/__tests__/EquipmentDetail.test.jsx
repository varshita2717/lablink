import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import EquipmentDetail from '../EquipmentDetail.jsx';
import { Route, renderRoutes } from '../../testUtils.jsx';
import { loadActiveEquipment } from '../../lib/inventory.js';
import { bookPlan } from '../../lib/booking.js';
import { AppError, ERROR_CODES } from '../../lib/errors.js';

vi.mock('../../lib/firebase.js', () => ({ db: {}, auth: {} }));
vi.mock('../../lib/inventory.js', () => ({ loadActiveEquipment: vi.fn() }));
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

const renderDetail = (id) =>
  renderRoutes(
    <>
      <Route path="/equipment/:id" element={<EquipmentDetail />} />
      <Route path="/" element={<p>Chat home</p>} />
    </>,
    { path: `/equipment/${id}` },
  );

describe('EquipmentDetail', () => {
  beforeEach(() => {
    loadActiveEquipment.mockResolvedValue([MULTIMETER, MANTLE]);
    bookPlan.mockReset();
  });

  it('books an open item for the selected contiguous hours', async () => {
    const user = userEvent.setup();
    bookPlan.mockResolvedValue(['b1']);
    const { container } = renderDetail('eq-multimeter');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Multimeter' }),
    ).toBeInTheDocument();
    expect(document.title).toBe('Multimeter · LabLink');
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
});
