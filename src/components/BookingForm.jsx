import { useState } from 'react';
import { Link } from 'react-router-dom';
import useAuth from '../hooks/useAuth.js';
import { bookPlan } from '../lib/booking.js';
import { ERROR_CODES } from '../lib/errors.js';
import { formatSession } from '../lib/format.js';
import ErrorMessage from './ErrorMessage.jsx';
import SlotSelectionFields from './SlotSelectionFields.jsx';
import useSlotSelection from '../hooks/useSlotSelection.js';

/**
 * Direct booking of one open item: pick hours on the grid, choose units, book.
 * @param {{ item: object, dates: string[], remainingByDate: Record<string, number[]>,
 *           onBooked: () => void }} props
 */
export default function BookingForm({ item, dates, remainingByDate, onBooked }) {
  const { user } = useAuth();
  const slots = useSlotSelection(item);
  const { selection, qty, unitsValid } = slots;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const handleBook = async () => {
    setPending(true);
    setError(null);
    setSuccess(null);
    try {
      await bookPlan({ user, entries: [{ equipment: item, ...selection, qty }] });
      setSuccess(`Booked ${qty} × ${item.name} for ${formatSession(selection)}.`);
      slots.clear();
      onBooked();
    } catch (err) {
      console.error('Booking failed', err);
      setError(err);
      if (err?.code === ERROR_CODES.SLOT_FULL) onBooked(); // refresh availability
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-4">
      <SlotSelectionFields
        item={item}
        dates={dates}
        remainingByDate={remainingByDate}
        slots={slots}
      />
      <div aria-live="polite">
        {success && (
          <p className="mt-2 text-green-900">
            {success}{' '}
            <Link to="/my-bookings" className="font-semibold underline">
              See my bookings
            </Link>
          </p>
        )}
      </div>
      {error && <ErrorMessage error={error} />}
      <button
        type="button"
        onClick={handleBook}
        disabled={!selection || !unitsValid || pending}
        className="btn-primary"
      >
        {selection ? `Book ${item.name}, ${formatSession(selection)}` : 'Book'}
      </button>
    </div>
  );
}
