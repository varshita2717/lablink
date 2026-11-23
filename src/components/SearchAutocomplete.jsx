import { useEffect, useId, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ACCESS_LABELS, SEARCH_DEBOUNCE_MS } from '../lib/config.js';
import { suggestEquipment } from '../lib/inventory.js';

/** Splits `text` around the first case-insensitive match, highlighting it with <mark> (React nodes only). */
function highlight(text, query) {
  const at = query ? text.toLowerCase().indexOf(query.toLowerCase()) : -1;
  if (at < 0) return text;
  return (
    <>
      {text.slice(0, at)}
      <mark className="rounded bg-amber-100 px-0.5 text-slate-900">
        {text.slice(at, at + query.length)}
      </mark>
      {text.slice(at + query.length)}
    </>
  );
}

/**
 * Catalogue search with equipment suggestions (WAI-ARIA combobox with a listbox popup).
 * Uses the already-loaded equipment list, so it makes no Firestore reads. Typing still updates the
 * catalogue filter through `onChange`; choosing a suggestion opens its detail page.
 * @param {{ id: string, value: string, onChange: (value: string) => void, equipment: object[] }} props
 */
export default function SearchAutocomplete({ id, value, onChange, equipment }) {
  const navigate = useNavigate();
  const listboxId = useId();
  const [debounced, setDebounced] = useState(value);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [value]);

  const query = debounced.trim();
  const suggestions = useMemo(() => suggestEquipment(query, equipment), [query, equipment]);
  const expanded = open && query.length > 0 && suggestions.length > 0;
  const showNoMatch = open && query.length > 0 && suggestions.length === 0;
  const optionId = (index) => `${listboxId}-option-${index}`;

  const close = () => {
    setOpen(false);
    setActive(-1);
  };
  const choose = (item) => {
    close();
    navigate(`/equipment/${item.id}`);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      if (suggestions.length === 0) return;
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((current) => (current + step + suggestions.length) % suggestions.length);
    } else if (event.key === 'Enter' && expanded && active >= 0) {
      event.preventDefault();
      choose(suggestions[active]);
    } else if (event.key === 'Escape') {
      close();
    } else if (event.key === 'Tab') {
      close();
    }
  };

  let announcement = '';
  if (expanded)
    announcement = `${suggestions.length} ${suggestions.length === 1 ? 'suggestion' : 'suggestions'} available`;
  else if (showNoMatch) announcement = 'No equipment matches';

  return (
    <div className="relative">
      <input
        id={id}
        name="query"
        type="text"
        role="combobox"
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={listboxId}
        aria-activedescendant={expanded && active >= 0 ? optionId(active) : undefined}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onKeyDown={handleKeyDown}
        onBlur={close}
        placeholder="e.g. oscilloscope, heating"
        className="field"
      />
      <div
        id={listboxId}
        role="listbox"
        aria-label="Equipment suggestions"
        hidden={!expanded}
        className="absolute z-30 mt-1 max-h-80 w-full min-w-64 overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
      >
        {suggestions.map((item, index) => (
          <div
            key={item.id}
            id={optionId(index)}
            role="option"
            tabIndex={-1}
            aria-selected={index === active}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => choose(item)}
            onKeyDown={(event) => event.key === 'Enter' && choose(item)}
            onMouseEnter={() => setActive(index)}
            className={`cursor-pointer px-3 py-2 text-sm ${index === active ? 'bg-indigo-50' : ''}`}
          >
            <span className="block font-medium text-slate-900">{highlight(item.name, query)}</span>
            <span className="block text-xs text-slate-600">
              {item.category} · {ACCESS_LABELS[item.accessLevel]}
            </span>
          </div>
        ))}
      </div>
      {showNoMatch && (
        <p className="absolute z-30 mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-lg">
          No equipment matches
        </p>
      )}
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}
