import { useCallback } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import useAsync from '../hooks/useAsync.js';
import useDocumentTitle from '../hooks/useDocumentTitle.js';
import { loadAvailability } from '../lib/booking.js';
import { horizonDates, today } from '../lib/dates.js';
import { loadActiveEquipment } from '../lib/inventory.js';
import AccessBadge from '../components/AccessBadge.jsx';
import BookingForm from '../components/BookingForm.jsx';
import EmptyState from '../components/EmptyState.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import HazardBadge from '../components/HazardBadge.jsx';
import SlotPicker from '../components/SlotPicker.jsx';
import Spinner from '../components/Spinner.jsx';

/** Loads one active item and its availability over the booking horizon. */
async function loadDetail(id) {
  const item = (await loadActiveEquipment()).find((candidate) => candidate.id === id) ?? null;
  if (!item) return { item: null };
  const dates = horizonDates(today());
  const availability = await loadAvailability([item], dates);
  return { item, dates, remainingByDate: availability[item.id] };
}

/** Equipment details, safety note, availability grid; Book (open) or Request via chat (approval). */
export default function EquipmentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const loader = useCallback(() => loadDetail(id), [id]);
  const { data, error, loading, reload } = useAsync(loader);
  const item = data?.item;
  useDocumentTitle(item ? item.name : 'Equipment');

  if (error) return <ErrorMessage error={error} onRetry={reload} />;
  if (loading && !data) return <Spinner label="Loading equipment" />;
  if (!item) {
    return (
      <>
        <h1 className="mb-4 text-2xl font-bold">Equipment not found</h1>
        <EmptyState title="This equipment does not exist or is not available." icon="search">
          <Link to="/catalogue" className="btn-primary">
            Back to the catalogue
          </Link>
        </EmptyState>
      </>
    );
  }

  const requestViaChat = () =>
    navigate('/', {
      state: {
        prefill: `I would like to request the ${item.name} for my project. Can you help me plan the sessions?`,
      },
    });

  return (
    <div className="space-y-6" aria-busy={loading}>
      <div>
        <Link to="/catalogue" className="text-sm font-semibold text-indigo-700 underline">
          Back to the catalogue
        </Link>
        <h1 className="mt-2 text-2xl font-bold">{item.name}</h1>
        <p className="text-slate-700">
          {item.category} · {item.labName} · {item.department} · {item.quantity}{' '}
          {item.quantity === 1 ? 'unit' : 'units'}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <AccessBadge accessLevel={item.accessLevel} />
          <HazardBadge hazardLevel={item.hazardLevel} />
        </div>
        <p className="mt-3 max-w-prose text-slate-800">{item.description}</p>
      </div>

      {item.hazardLevel !== 'none' && item.safetyNote && (
        <section
          aria-labelledby="safety-heading"
          className="rounded-lg border border-amber-300 bg-amber-50 p-4"
        >
          <h2 id="safety-heading" className="font-semibold text-amber-950">
            Safety note
          </h2>
          <p className="mt-1 text-amber-950">{item.safetyNote}</p>
        </section>
      )}

      <section aria-labelledby="availability-heading">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 id="availability-heading" className="text-xl font-semibold">
            {item.accessLevel === 'open' ? 'Book a time' : 'Availability'}
          </h2>
          <button type="button" onClick={reload} disabled={loading} className="btn-secondary">
            Refresh
          </button>
        </div>
        {item.accessLevel === 'open' ? (
          <BookingForm
            item={item}
            dates={data.dates}
            remainingByDate={data.remainingByDate}
            onBooked={reload}
          />
        ) : (
          <div className="space-y-4">
            <p className="text-slate-700">
              This equipment needs faculty approval. Ask the assistant to plan your sessions and
              prepare a request for your faculty guide.
            </p>
            <button type="button" onClick={requestViaChat} className="btn-primary">
              Request this via chat
            </button>
            <SlotPicker
              caption={`Free units of ${item.name} per hour (out of ${item.quantity})`}
              dates={data.dates}
              remainingByDate={data.remainingByDate}
              quantity={item.quantity}
            />
          </div>
        )}
      </section>
    </div>
  );
}
