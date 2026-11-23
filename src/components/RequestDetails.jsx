import { STAGE_LABELS } from '../lib/config.js';
import { formatDate, formatSession } from '../lib/format.js';

/**
 * Items, sessions, deadline, justification and hazard note of a request.
 * @param {{ request: object }} props
 */
export default function RequestDetails({ request }) {
  return (
    <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[max-content_1fr]">
      <dt className="font-semibold">Equipment</dt>
      <dd>{request.items.map((item) => `${item.qty} × ${item.equipmentName}`).join(', ')}</dd>
      <dt className="font-semibold">Sessions</dt>
      <dd>
        <ul>
          {request.sessions.map((session) => (
            <li key={`${session.date}-${session.startHour}`}>{formatSession(session)}</li>
          ))}
        </ul>
      </dd>
      <dt className="font-semibold">Deadline and stage</dt>
      <dd>
        {formatDate(request.deadline)} · {STAGE_LABELS[request.stage] ?? request.stage}
      </dd>
      {request.justification && (
        <>
          <dt className="font-semibold">Justification</dt>
          <dd className="whitespace-pre-wrap">{request.justification}</dd>
        </>
      )}
      {request.hazardNote && (
        <>
          <dt className="font-semibold">
            <span aria-hidden="true">⚠ </span>Safety note
          </dt>
          <dd className="text-amber-950">{request.hazardNote}</dd>
        </>
      )}
    </dl>
  );
}
