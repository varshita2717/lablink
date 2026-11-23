import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import useAsync from '../hooks/useAsync.js';
import useDocumentTitle from '../hooks/useDocumentTitle.js';
import { loadConflictContext } from '../lib/requests.js';
import { today } from '../lib/dates.js';
import ConflictGroup from '../components/ConflictGroup.jsx';
import EmptyState from '../components/EmptyState.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import Spinner from '../components/Spinner.jsx';

/** Conflict groups among pending requests; each can be resolved by the fairness formula. */
export default function Conflicts() {
  useDocumentTitle('Conflicts');
  const loader = useCallback(() => loadConflictContext(today()), []);
  const { data, error, loading, reload } = useAsync(loader);
  const [notice, setNotice] = useState('');

  const handleConfirmed = (message) => {
    setNotice(message);
    reload();
  };

  return (
    <div aria-busy={loading}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Scheduling conflicts</h1>
        <button
          type="button"
          onClick={reload}
          disabled={loading}
          className="rounded-md border border-blue-800 px-3 py-1.5 font-semibold text-blue-900 hover:bg-blue-50 disabled:opacity-60"
        >
          Refresh
        </button>
      </div>
      <p className="mt-2 max-w-prose text-slate-700">
        When pending requests ask for more units than are free, they are ranked by deadline urgency,
        fairness of recent use and project stage. The top requests that fit are booked; the others
        are offered alternative slots.
      </p>
      <p aria-live="polite" className="mt-3 font-medium text-green-900">
        {notice}
      </p>
      {error && <ErrorMessage error={error} onRetry={reload} />}
      {loading && !data && <Spinner label="Loading conflicts" />}
      {data && data.groups.length === 0 && (
        <EmptyState title="No conflicts right now">
          <Link to="/approvals" className="font-semibold text-blue-900 underline">
            Review the approval queue
          </Link>
        </EmptyState>
      )}
      {data && data.groups.length > 0 && (
        <ul className="mt-4 space-y-4">
          {data.groups.map((group, index) => {
            const requests = data.pending.filter((r) => group.requestIds.includes(r.id));
            return (
              <li key={group.requestIds.join('|')}>
                <ConflictGroup
                  index={index}
                  requests={requests}
                  context={data}
                  onConfirmed={handleConfirmed}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
