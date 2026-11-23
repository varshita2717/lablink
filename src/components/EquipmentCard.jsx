import AccessBadge from './AccessBadge.jsx';
import HazardBadge from './HazardBadge.jsx';
import StatusBadge from './StatusBadge.jsx';

/**
 * Catalogue card: name, location, description, capacity and text badges.
 * @param {{ item: object, utilisation?: { label: string } }} props
 */
export default function EquipmentCard({ item, utilisation }) {
  const headingId = `equipment-${item.id}`;
  return (
    <article
      aria-labelledby={headingId}
      className="flex h-full flex-col rounded-lg border border-slate-200 bg-white p-4"
    >
      <h3 id={headingId} className="text-lg font-semibold text-slate-900">
        {item.name}
      </h3>
      <p className="text-sm text-slate-700">
        {item.category} · {item.labName} · {item.department}
      </p>
      <p className="mt-2 flex-1 text-slate-800">{item.description}</p>
      <p className="mt-2 text-sm text-slate-700">
        {item.quantity} {item.quantity === 1 ? 'unit' : 'units'}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <AccessBadge accessLevel={item.accessLevel} />
        <HazardBadge hazardLevel={item.hazardLevel} />
        {utilisation && (
          <StatusBadge
            status={utilisation.label.toLowerCase()}
            label={`${utilisation.label} this week`}
          />
        )}
      </div>
    </article>
  );
}
