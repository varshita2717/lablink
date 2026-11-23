import { Link } from 'react-router-dom';
import AccessBadge from './AccessBadge.jsx';
import HazardBadge from './HazardBadge.jsx';
import Icon, { CATEGORY_ICONS } from './Icon.jsx';
import StatusBadge from './StatusBadge.jsx';

/**
 * Catalogue card: category icon, name, location, description, capacity, text badges and a View link.
 * @param {{ item: object, utilisation?: { label: string } }} props
 */
export default function EquipmentCard({ item, utilisation }) {
  const headingId = `equipment-${item.id}`;
  return (
    <article aria-labelledby={headingId} className="card card-hover flex h-full flex-col p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
          <Icon name={CATEGORY_ICONS[item.category]} className="h-5 w-5" />
        </span>
        <div>
          <h3 id={headingId} className="font-semibold text-slate-900">
            {item.name}
          </h3>
          <p className="text-sm text-slate-600">
            {item.category} · {item.labName} · {item.department}
          </p>
        </div>
      </div>
      <p className="mt-3 flex-1 text-sm text-slate-700">{item.description}</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <AccessBadge accessLevel={item.accessLevel} />
        <HazardBadge hazardLevel={item.hazardLevel} />
        {utilisation && (
          <StatusBadge
            status={utilisation.label.toLowerCase()}
            label={`${utilisation.label} this week`}
          />
        )}
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
        <span className="text-sm text-slate-600">
          {item.quantity} {item.quantity === 1 ? 'unit' : 'units'}
        </span>
        <Link to={`/equipment/${item.id}`} className="btn-secondary min-h-9 px-3 py-1.5">
          View<span className="sr-only"> {item.name}</span>
          <Icon name="arrow" className="h-4 w-4" />
        </Link>
      </div>
    </article>
  );
}
