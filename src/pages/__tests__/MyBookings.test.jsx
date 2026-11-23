import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import MyBookings from '../MyBookings.jsx';
import { Route, renderRoutes } from '../../testUtils.jsx';
import { cancelBooking, loadMyBookings } from '../../lib/booking.js';

vi.mock('../../lib/firebase.js', () => ({ db: {}, auth: {} }));
vi.mock('../../lib/booking.js', () => ({ loadMyBookings: vi.fn(), cancelBooking: vi.fn() }));
vi.mock('../../lib/dates.js', async (importOriginal) => ({
  ...(await importOriginal()),
  today: () => '2026-11-23',
}));

const booking = (overrides) => ({
  id: 'b1',
  equipmentName: 'Multimeter',
  date: '2026-11-24',
  startHour: 10,
  endHour: 12,
  qty: 1,
  status: 'confirmed',
  ...overrides,
});

const renderPage = () => renderRoutes(<Route path="/" element={<MyBookings />} />);

describe('MyBookings', () => {
  beforeEach(() => {
    cancelBooking.mockReset();
    loadMyBookings.mockResolvedValue([
      booking(),
      booking({ id: 'b2', date: '2026-11-20', startHour: 9, endHour: 10 }),
    ]);
  });

  it('splits upcoming and past, and only future confirmed bookings can be cancelled', async () => {
    const { container } = renderPage();
    expect(await screen.findByRole('heading', { name: 'Upcoming' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Past' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Cancel booking/ })).toHaveLength(1);
    expect(screen.getAllByText('Confirmed')).toHaveLength(2);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('cancels a booking and refreshes the list', async () => {
    const user = userEvent.setup();
    cancelBooking.mockResolvedValue();
    renderPage();
    await user.click(
      await screen.findByRole('button', {
        name: 'Cancel booking for Multimeter on Tue 24 Nov, 10:00–12:00',
      }),
    );
    expect(cancelBooking).toHaveBeenCalledWith('b1', expect.objectContaining({ uid: 'u1' }));
    expect(
      await screen.findByText('Cancelled Multimeter on Tue 24 Nov, 10:00–12:00.'),
    ).toBeInTheDocument();
    expect(loadMyBookings).toHaveBeenCalledTimes(2);
  });

  it('shows an empty state with a next step', async () => {
    loadMyBookings.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText('You have no bookings yet')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Find equipment in the catalogue' }),
    ).toBeInTheDocument();
  });
});
