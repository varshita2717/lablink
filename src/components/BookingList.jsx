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
          <li
            key={booking.id}
            className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-4"
          >
            <div className="flex-1">
              <p className="font-semibold">{booking.equipmentName}</p>
              <p className="text-slate-700">
                {formatSession(booking)} · {booking.qty} {booking.qty === 1 ? 'unit' : 'units'}
              </p>
            </div>
            <StatusBadge status={booking.status} />
            {onCancel && booking.status === 'confirmed' && (
              <button
                type="button"
                onClick={() => onCancel(booking)}
                disabled={cancellingId !== null}
                className="rounded-md border border-red-800 px-3 py-1 text-sm font-semibold text-red-900 hover:bg-red-50 disabled:opacity-60"
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
