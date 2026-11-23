import { formatSession } from '../lib/format.js';

/**
 * Alternative sessions offered to a request that was not allocated.
 * @param {{ alternatives: { sessions: object[], substitutions: object[], complete: boolean } | null }} props
 */
export default function AlternativesList({ alternatives }) {
  if (!alternatives?.sessions?.length) {
    return <p>No alternative slots were found before the deadline.</p>;
  }
  return (
    <div>
      <ul>
        {alternatives.sessions.map((session) => (
          <li key={`${session.date}-${session.startHour}`}>{formatSession(session)}</li>
        ))}
      </ul>
      {alternatives.substitutions.map((swap) => (
        <p key={swap.originalEquipmentId}>Substitute: {swap.replacement.name}</p>
      ))}
      {!alternatives.complete && <p>Fewer sessions than requested.</p>}
    </div>
  );
}
