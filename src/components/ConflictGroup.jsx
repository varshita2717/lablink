import { useId, useState } from 'react';
import useAuth from '../hooks/useAuth.js';
import { confirmAllocation, resolveConflict } from '../lib/requests.js';
import { templateExplanation } from '../lib/agent/explain.js';
import { today } from '../lib/dates.js';
import { formatSession } from '../lib/format.js';
import ErrorMessage from './ErrorMessage.jsx';
import ExplanationCard from './ExplanationCard.jsx';
import RankingTable from './RankingTable.jsx';
import Spinner from './Spinner.jsx';

/**
 * One conflict group: Resolve → ranking, alternatives and explanation → Confirm allocation.
 * @param {{ index: number, requests: object[], context: object, onConfirmed: (message: string) => void }} props
 */
export default function ConflictGroup({ index, requests, context, onConfirmed }) {
  const { user } = useAuth();
  const id = useId();
  const [resolution, setResolution] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const equipmentNames = [...new Set(requests.flatMap((r) => r.items.map((i) => i.equipmentName)))];

  const run = async (action) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      console.error('Conflict action failed', err);
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const handleResolve = () =>
    run(async () => setResolution(await resolveConflict(requests, context, today())));

  const handleConfirm = () =>
    run(async () => {
      const byId = Object.fromEntries(requests.map((r) => [r.id, r]));
      const result = await confirmAllocation(resolution, byId, user, today());
      const names = (ids) => ids.map((rid) => byId[rid].studentName).join(', ') || 'nobody';
      const failed = result.failedWinners.length
        ? ` Slots were taken for ${names(result.failedWinners)}, so they were given alternatives instead.`
        : '';
      onConfirmed(
        `Allocation confirmed. Booked: ${names(result.approved)}. Offered alternatives: ${names(result.lost)}.${failed}`,
      );
    });

  return (
    <article
      aria-labelledby={`${id}-title`}
      className="rounded-lg border border-slate-200 bg-white p-4"
      aria-busy={busy}
    >
      <h2 id={`${id}-title`} className="text-lg font-semibold">
        Conflict {index + 1}: {equipmentNames.join(', ')}
      </h2>
      <ul className="mt-2 space-y-1 text-sm">
        {requests.map((request) => (
          <li key={request.id}>
            <span className="font-semibold">{request.studentName}</span>, {request.projectTitle}:{' '}
            {request.sessions.map(formatSession).join('; ')}
          </li>
        ))}
      </ul>
      {!resolution && (
        <button
          type="button"
          onClick={handleResolve}
          disabled={busy}
          className="mt-4 rounded-md bg-blue-800 px-4 py-2 font-semibold text-white hover:bg-blue-900 disabled:opacity-60"
        >
          Resolve conflict {index + 1}
        </button>
      )}
      {busy && <Spinner label={resolution ? 'Confirming allocation' : 'Ranking requests'} />}
      {error && (
        <div className="mt-3">
          <ErrorMessage error={error} />
        </div>
      )}
      {resolution && (
        <div className="mt-4 space-y-4">
          <RankingTable resolution={resolution} caption={`Ranking for conflict ${index + 1}`} />
          <ExplanationCard text={templateExplanation(resolution)} />
          <button
            type="button"
            onClick={handleConfirm}
            disabled={busy}
            className="rounded-md bg-green-800 px-4 py-2 font-semibold text-white hover:bg-green-900 disabled:opacity-60"
          >
            Confirm allocation for conflict {index + 1}
          </button>
        </div>
      )}
    </article>
  );
}
