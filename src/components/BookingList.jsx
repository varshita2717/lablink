import { formatSession } from '../lib/format.js';
import StatusBadge from './StatusBadge.jsx';

/**
 * A titled list of bookings. When `onCancel` is given, confirmed bookings get a Cancel button.
 * @param {{ title: string, bookings: object[], cancellingId: string | null,
 *           onCancel?: (booking: object) => void }} props
 */
export default function BookingList({ title, bookings, cancellingId, onCancel }) {
  const headingId = `${title.toLowerCase()}-heading`;
  return (
    <section aria-labelledby={headingId} className="mt-6">
      <h2 id={headingId} className="text-xl font-semibold">
        {title}
      </h2>
      <ul className="mt-3 space-y-3">
        {bookings.map((booking) => (
          <li key={booking.id} className="flex flex-wrap items-center gap-3 card p-5">
            <div className="flex-1">
              <p className="font-semibold">{booking.equipmentName}</p>
              <p className="text-muted">
                {formatSession(booking)} · {booking.qty} {booking.qty === 1 ? 'unit' : 'units'}
              </p>
            </div>
            <StatusBadge status={booking.status} />
            {onCancel && booking.status === 'confirmed' && (
              <button
                type="button"
                onClick={() => onCancel(booking)}
                disabled={cancellingId !== null}
                className="btn-danger"
              >
                Cancel booking for {booking.equipmentName} on {formatSession(booking)}
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
