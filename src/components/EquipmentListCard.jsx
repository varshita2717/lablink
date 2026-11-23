import { useId } from 'react';
import { Link } from 'react-router-dom';
import { formatDate } from '../lib/format.js';
import AccessBadge from './AccessBadge.jsx';
import HazardBadge from './HazardBadge.jsx';

/**
 * Recommended equipment with access, hazard and availability (all from data), substitutes and
 * safety notes. Informational: no Confirm.
 * @param {{ data: object }} props Output of recommendEquipment.
 */
export default function EquipmentListCard({ data }) {
  const id = useId();
  return (
    <article aria-labelledby={id} className="card p-5">
      <h2 id={id} className="text-lg font-semibold text-ink">
        Recommended equipment
        {data.matchedExperiment ? ` for "${data.matchedExperiment.title}"` : ''}
      </h2>
      {data.aiMatching === 'unavailable' && (
        <p className="mt-1 text-sm text-muted">
          AI matching is unavailable; these are keyword matches.
        </p>
      )}
      <p className="mt-2 font-semibold">
        {data.needsApproval ? 'Needs faculty approval' : 'Books immediately (open equipment)'}
      </p>
      <ul className="mt-3 space-y-3">
        {data.items.map((item) => (
          <li key={item.equipmentId} className="border-t border-line pt-2">
            <p>
              <Link
                to={`/equipment/${item.equipmentId}`}
                className="font-semibold text-maroon underline"
              >
                {item.name}
              </Link>{' '}
              × {item.qty}
              {item.role ? ` (${item.role})` : ''}
            </p>
            <div className="mt-1 flex flex-wrap gap-2">
              <AccessBadge accessLevel={item.accessLevel} />
              <HazardBadge hazardLevel={item.hazardLevel} />
              <span className="text-sm">
                {item.availableTomorrow ? 'Free' : 'Not free'} on {formatDate(data.date)}
              </span>
            </div>
            {!item.availableTomorrow && item.substitutes.length > 0 && (
              <p className="mt-1 text-sm font-medium text-maroon">
                Substitute available: {item.substitutes.map((s) => s.name).join(', ')}
              </p>
            )}
          </li>
        ))}
      </ul>
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
    </article>
  );
}
