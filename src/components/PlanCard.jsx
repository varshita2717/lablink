import { useId } from 'react';
import { formatSession } from '../lib/format.js';
import AccessBadge from './AccessBadge.jsx';
import CardActions from './CardActions.jsx';
import HazardBadge from './HazardBadge.jsx';

/**
 * Drafted plan: items, sessions, substitutions (highlighted in text), safety notes and a banner
 * saying whether it books immediately or needs faculty approval (SPEC 13.4).
 * @param {{ card: { data: object, status: string, error?: string }, onConfirm: () => void,
 *           onCancel: () => void }} props
 */
export default function PlanCard({ card, onConfirm, onCancel }) {
  const id = useId();
  const { data } = card;
  return (
    <article aria-labelledby={id} className="card p-5">
      <h2 id={id} className="text-lg font-semibold text-ink">
        Plan for {data.project.title}
      </h2>
      <p
        className={`mt-2 rounded-lg px-3 py-1.5 font-semibold ${
          data.needsApproval ? 'bg-amber-100 text-amber-950' : 'bg-green-100 text-green-950'
        }`}
      >
        {data.needsApproval ? 'Needs faculty approval' : 'Books immediately'}
      </p>
      <h3 className="mt-3 text-sm font-semibold">Equipment</h3>
      <ul className="text-sm">
        {data.items.map((item) => (
          <li key={item.equipmentId} className="mt-1 flex flex-wrap items-center gap-2">
            <span>
              {item.qty} × {item.name}
            </span>
            <AccessBadge accessLevel={item.accessLevel} />
            <HazardBadge hazardLevel={item.hazardLevel} />
          </li>
        ))}
      </ul>
      {data.substitutions.length > 0 && (
        <p className="mt-2 rounded-lg border border-line bg-cream px-3 py-1.5 text-sm text-maroon">
          <span className="font-semibold">Substitution: </span>
          {data.substitutions
            .map((s) => `${s.replacement.name} replaces ${s.originalName}`)
            .join('; ')}
        </p>
      )}
      <h3 className="mt-3 text-sm font-semibold">
        Sessions ({data.found} of {data.requested})
      </h3>
      <ul className="text-sm">
        {data.sessions.map((session) => (
          <li key={`${session.date}-${session.startHour}`}>{formatSession(session)}</li>
        ))}
      </ul>
      {!data.complete && (
        <p className="mt-1 text-sm text-amber-950">Fewer sessions were found than requested.</p>
      )}
      {data.safetyNotes.length > 0 && (
        <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
          <p className="font-semibold">
            <span aria-hidden="true">⚠ </span>Safety
          </p>
          {data.safetyNotes.map((note) => (
            <p key={note}>{note}</p>
          ))}
        </div>
      )}
      <CardActions
        status={card.status}
        error={card.error}
        subject={`plan for ${data.project.title}`}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    </article>
  );
}
