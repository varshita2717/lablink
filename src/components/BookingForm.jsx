import { useState } from 'react';
import { Link } from 'react-router-dom';
import useAuth from '../hooks/useAuth.js';
import { bookPlan } from '../lib/booking.js';
import { MAX_HOURS_PER_DAY } from '../lib/config.js';
import { ERROR_CODES } from '../lib/errors.js';
import { formatSession } from '../lib/format.js';
import ErrorMessage from './ErrorMessage.jsx';
import SlotPicker from './SlotPicker.jsx';

/**
 * Next selection after a cell click: extend or shrink a contiguous range on one date
 * (up to MAX_HOURS_PER_DAY hours), or start a new one-hour selection.
 */
function nextSelection(current, date, hour) {
  const single = { date, startHour: hour, endHour: hour + 1 };
  if (!current || current.date !== date) return single;
  const { startHour, endHour } = current;
  const length = endHour - startHour;
  if (length === 1 && hour === startHour) return null;
  if (hour === endHour && length < MAX_HOURS_PER_DAY) return { date, startHour, endHour: hour + 1 };
  if (hour === startHour - 1 && length < MAX_HOURS_PER_DAY)
    return { date, startHour: hour, endHour };
  if (hour === startHour) return { date, startHour: hour + 1, endHour };
  if (hour === endHour - 1) return { date, startHour, endHour: hour };
  return single;
}

/**
 * Direct booking of one open item: pick hours on the grid, choose units, book.
 * @param {{ item: object, dates: string[], remainingByDate: Record<string, number[]>,
 *           onBooked: () => void }} props
 */
export default function BookingForm({ item, dates, remainingByDate, onBooked }) {
  const { user } = useAuth();
  const [selection, setSelection] = useState(null);
  const [units, setUnits] = useState('1');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const qty = Number(units);
  const unitsValid = Number.isInteger(qty) && qty >= 1 && qty <= item.quantity;

  const handleBook = async () => {
    setPending(true);
    setError(null);
    setSuccess(null);
    try {
      await bookPlan({ user, entries: [{ equipment: item, ...selection, qty }] });
      setSuccess(`Booked ${qty} × ${item.name} for ${formatSession(selection)}.`);
      setSelection(null);
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
      <div className="max-w-xs">
        <label htmlFor="units" className="font-medium">
          Units needed (required, 1 to {item.quantity})
        </label>
        <input
          id="units"
          type="number"
          inputMode="numeric"
          min={1}
          max={item.quantity}
          required
          value={units}
          onChange={(event) => setUnits(event.target.value)}
          aria-invalid={!unitsValid}
          aria-describedby={unitsValid ? undefined : 'units-error'}
          className="field"
        />
        {!unitsValid && (
          <p id="units-error" role="alert" className="mt-1 text-sm text-red-800">
            Enter a whole number from 1 to {item.quantity}.
          </p>
        )}
      </div>
      <p className="text-muted">
        Select up to {MAX_HOURS_PER_DAY} consecutive hours on one day. Select a neighbouring hour to
        extend the booking, or an end hour to shorten it.
      </p>
      <SlotPicker
        caption={`Free units of ${item.name} per hour (out of ${item.quantity})`}
        dates={dates}
        remainingByDate={remainingByDate}
        quantity={item.quantity}
        unitsNeeded={unitsValid ? qty : 1}
        selection={selection}
        onCellClick={(date, hour) => setSelection((current) => nextSelection(current, date, hour))}
      />
      <div aria-live="polite">
        <p className="font-medium">
          {selection ? `Selected: ${formatSession(selection)}` : 'No time selected yet.'}
        </p>
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
