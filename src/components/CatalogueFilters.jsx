import { ACCESS_LABELS, ACCESS_LEVELS, CATEGORIES } from '../lib/config.js';
import { formatDate } from '../lib/format.js';
import SearchAutocomplete from './SearchAutocomplete.jsx';

const fieldClass = 'field';

/**
 * Catalogue filter form. Every control is labelled; "Any" (empty value) matches everything.
 * @param {{ values: object, onChange: (name: string, value: string) => void,
 *           departments: string[], dates: string[], equipment: object[] }} props
 */
export default function CatalogueFilters({ values, onChange, departments, dates, equipment }) {
  const handle = (event) => onChange(event.target.name, event.target.value);
  const select = (name, label, options) => (
    <div>
      <label htmlFor={`filter-${name}`} className="text-sm font-medium text-muted">
        {label}
      </label>
      <select
        id={`filter-${name}`}
        name={name}
        value={values[name]}
        onChange={handle}
        className={fieldClass}
      >
        <option value="">Any</option>
        {options.map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <form
      role="search"
      aria-label="Filter equipment"
      onSubmit={(event) => event.preventDefault()}
      className="card grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-5"
    >
      <div className="sm:col-span-2 lg:col-span-1">
        <label htmlFor="filter-query" className="text-sm font-medium text-muted">
          Search
        </label>
        <SearchAutocomplete
          id="filter-query"
          value={values.query}
          onChange={(value) => onChange('query', value)}
          equipment={equipment}
        />
      </div>
      {select(
        'department',
        'Department',
        departments.map((d) => [d, d]),
      )}
      {select(
        'category',
        'Category',
        CATEGORIES.map((c) => [c, c]),
      )}
      {select(
        'accessLevel',
        'Access',
        ACCESS_LEVELS.map((a) => [a, ACCESS_LABELS[a]]),
      )}
      {select(
        'freeOn',
        'Free on',
        dates.map((d) => [d, formatDate(d)]),
      )}
    </form>
  );
}
