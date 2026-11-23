import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import useAsync from '../hooks/useAsync.js';
import useAuth from '../hooks/useAuth.js';
import useDocumentTitle from '../hooks/useDocumentTitle.js';
import { cancelBooking, loadMyBookings } from '../lib/booking.js';
import { daysBetween, today } from '../lib/dates.js';
import { formatSession } from '../lib/format.js';
import EmptyState from '../components/EmptyState.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import PageHeader from '../components/PageHeader.jsx';
import Spinner from '../components/Spinner.jsx';
import BookingList from '../components/BookingList.jsx';

/** The signed-in user's upcoming and past bookings. */
export default function MyBookings() {
  useDocumentTitle('My bookings');
  const { user } = useAuth();
  const loader = useCallback(() => loadMyBookings(user.uid), [user.uid]);
  const { data, error, loading, reload } = useAsync(loader);
  const [cancellingId, setCancellingId] = useState(null);
  const [cancelError, setCancelError] = useState(null);
  const [notice, setNotice] = useState('');

  const handleCancel = async (booking) => {
    setCancellingId(booking.id);
    setCancelError(null);
    setNotice('');
    try {
      await cancelBooking(booking.id, user);
      setNotice(`Cancelled ${booking.equipmentName} on ${formatSession(booking)}.`);
      reload();
    } catch (err) {
      console.error('Cancel failed', err);
      setCancelError(err);
    } finally {
      setCancellingId(null);
    }
  };

  const now = today();
  const upcoming = (data ?? []).filter((b) => daysBetween(now, b.date) >= 1).reverse();
  const past = (data ?? []).filter((b) => daysBetween(now, b.date) < 1);

  return (
    <div aria-busy={loading}>
      <PageHeader
        title="My bookings"
        description="Your upcoming and past equipment bookings. Future bookings can be cancelled."
      >
        <button type="button" onClick={reload} disabled={loading} className="btn-secondary">
          Refresh
        </button>
      </PageHeader>
      <p aria-live="polite" className="mt-3 text-green-900">
        {notice}
      </p>
      {cancelError && <ErrorMessage error={cancelError} />}
      {error && <ErrorMessage error={error} onRetry={reload} />}
      {loading && !data && <Spinner label="Loading bookings" />}
      {data && data.length === 0 && (
        <div className="mt-6">
          <EmptyState title="You have no bookings yet" icon="calendar">
            <Link to="/catalogue" className="btn-primary">
              Find equipment in the catalogue
            </Link>
          </EmptyState>
        </div>
      )}
      {upcoming.length > 0 && (
        <BookingList
          title="Upcoming"
          bookings={upcoming}
          cancellingId={cancellingId}
          onCancel={handleCancel}
        />
      )}
      {past.length > 0 && <BookingList title="Past" bookings={past} cancellingId={null} />}
    </div>
  );
}
