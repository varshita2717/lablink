import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import useAsync from '../hooks/useAsync.js';
import useDocumentTitle from '../hooks/useDocumentTitle.js';
import { SEARCH_DEBOUNCE_MS } from '../lib/config.js';
import { horizonDates, today } from '../lib/dates.js';
import { filterEquipment, invalidateInventory, loadActiveEquipment } from '../lib/inventory.js';
import { loadAvailability } from '../lib/booking.js';
import { computeUtilisation } from '../lib/utilisation.js';
import CatalogueFilters from '../components/CatalogueFilters.jsx';
import EmptyState from '../components/EmptyState.jsx';
import EquipmentCard from '../components/EquipmentCard.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import PageHeader from '../components/PageHeader.jsx';
import SkeletonGrid from '../components/SkeletonGrid.jsx';
import Spinner from '../components/Spinner.jsx';

const EMPTY_FILTERS = { query: '', department: '', category: '', accessLevel: '', freeOn: '' };

/** Loads active equipment and one availability query for the 14-day horizon. */
async function loadCatalogue() {
  const equipment = await loadActiveEquipment();
  const dates = horizonDates(today());
  const availability = await loadAvailability(equipment, dates);
  const utilisation = computeUtilisation({ equipment, availability, dates });
  return {
    equipment,
    dates,
    availability,
    utilisationById: Object.fromEntries(utilisation.map((u) => [u.equipmentId, u])),
  };
}

/** Equipment catalogue with debounced search, filters and utilisation badges. */
export default function Catalogue() {
  useDocumentTitle('Catalogue');
  const location = useLocation();
  const loader = useCallback(() => loadCatalogue(), []);
  const { data, error, loading, reload } = useAsync(loader);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(filters.query), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [filters.query]);

  const departments = useMemo(
    () => [...new Set((data?.equipment ?? []).map((item) => item.department))].sort(),
    [data],
  );
  const results = useMemo(
    () =>
      data
        ? filterEquipment(data.equipment, { ...filters, query: debouncedQuery }, data.availability)
        : [],
    [data, filters, debouncedQuery],
  );

  const handleFilterChange = (name, value) =>
    setFilters((current) => ({ ...current, [name]: value }));
  const handleRefresh = () => {
    invalidateInventory();
    reload();
  };

  return (
    <div>
      <PageHeader
        title="Equipment catalogue"
        description="Equipment, dev kits and workstations across departments, with live availability for the next two weeks."
      >
        <button type="button" onClick={handleRefresh} disabled={loading} className="btn-secondary">
          Refresh
        </button>
      </PageHeader>
      {location.state?.notice && (
        <p
          role="status"
          className="mb-4 rounded-lg border border-line bg-cream px-4 py-2 text-maroon"
        >
          {location.state.notice}
        </p>
      )}
      <div>
        <CatalogueFilters
          values={filters}
          onChange={handleFilterChange}
          departments={departments}
          dates={data?.dates ?? []}
          equipment={data?.equipment ?? []}
        />
      </div>
      <section aria-labelledby="results-heading" aria-busy={loading} className="mt-6">
        <h2 id="results-heading" className="sr-only">
          Results
        </h2>
        {error && <ErrorMessage error={error} onRetry={reload} />}
        {loading && !data && (
          <>
            <Spinner label="Loading equipment" />
            <SkeletonGrid />
          </>
        )}
        {data && (
          <>
            <p aria-live="polite" className="mb-3 text-sm text-muted">
              {results.length} of {data.equipment.length} items shown
            </p>
            {results.length === 0 ? (
              <EmptyState title="No equipment matches these filters" icon="search">
                {data.equipment.length === 0
                  ? 'No equipment has been added yet. An admin can seed the demo data from the Admin page.'
                  : 'Try clearing a filter or searching for a different word.'}
                {data.equipment.length > 0 && (
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() => setFilters(EMPTY_FILTERS)}
                      className="btn-secondary"
                    >
                      Clear filters
                    </button>
                  </div>
                )}
              </EmptyState>
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {results.map((item) => (
                  <li key={item.id}>
                    <EquipmentCard item={item} utilisation={data.utilisationById[item.id]} />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>
    </div>
  );
}
