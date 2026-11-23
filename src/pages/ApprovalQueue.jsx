import { useCallback, useState } from 'react';
import useAsync from '../hooks/useAsync.js';
import useDocumentTitle from '../hooks/useDocumentTitle.js';
import { loadConflictContext } from '../lib/requests.js';
import { today } from '../lib/dates.js';
import ApprovalItem from '../components/ApprovalItem.jsx';
import EmptyState from '../components/EmptyState.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import PageHeader from '../components/PageHeader.jsx';
import Spinner from '../components/Spinner.jsx';

/** Pending requests for faculty and admins, with the conflict lock (Section 11.4). */
export default function ApprovalQueue() {
  useDocumentTitle('Approvals');
  const loader = useCallback(() => loadConflictContext(today()), []);
  const { data, error, loading, reload } = useAsync(loader);
  const [notice, setNotice] = useState('');

  const conflicted = new Set((data?.groups ?? []).flatMap((group) => group.requestIds));
  const handleDecided = (message) => {
    setNotice(message);
    reload();
  };

  return (
    <div aria-busy={loading}>
      <PageHeader
        title="Approval queue"
        description="Pending access requests from students. Requests in a conflict are resolved on the Conflicts page."
      >
        <button type="button" onClick={reload} disabled={loading} className="btn-secondary">
          Refresh
        </button>
      </PageHeader>
      <p aria-live="polite" className="mt-3 font-medium text-green-900">
        {notice}
      </p>
      {error && <ErrorMessage error={error} onRetry={reload} />}
      {loading && !data && <Spinner label="Loading requests" />}
      {data && data.pending.length === 0 && (
        <EmptyState title="No pending requests" icon="shield">
          New requests from students will appear here.
        </EmptyState>
      )}
      {data && data.pending.length > 0 && (
        <ul className="mt-4 space-y-4">
          {data.pending.map((request) => (
            <li key={request.id}>
              <ApprovalItem
                request={request}
                inConflict={conflicted.has(request.id)}
                onDecided={handleDecided}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
