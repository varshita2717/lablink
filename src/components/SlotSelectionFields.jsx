import { MAX_HOURS_PER_DAY } from '../lib/config.js';
import { formatSession } from '../lib/format.js';
import SlotPicker from './SlotPicker.jsx';

/**
 * Units field, help text, availability grid and the current selection (shared by booking and
 * manual requests).
 * @param {{ item: object, dates: string[], remainingByDate: Record<string, number[]>,
 *           slots: ReturnType<typeof import('../hooks/useSlotSelection.js').default> }} props
 */
export default function SlotSelectionFields({ item, dates, remainingByDate, slots }) {
  const { selection, selectCell, units, setUnits, qty, unitsValid } = slots;
  return (
    <>
      <div className="max-w-xs">
        <label htmlFor="units" className="font-medium">
          Units needed (required, 1 to {item.quantity})
        </label>
        <input
          id="units"
          type="number"
          inputMode="numeric"
          min={1}
          max={item.quantity}
          required
          value={units}
          onChange={(event) => setUnits(event.target.value)}
          aria-invalid={!unitsValid}
          aria-describedby={unitsValid ? undefined : 'units-error'}
          className="field"
        />
        {!unitsValid && (
          <p id="units-error" role="alert" className="mt-1 text-sm text-red-800">
            Enter a whole number from 1 to {item.quantity}.
          </p>
        )}
      </div>
      <p className="text-muted">
        Select up to {MAX_HOURS_PER_DAY} consecutive hours on one day. Select a neighbouring hour to
        extend the time, or an end hour to shorten it.
      </p>
      <SlotPicker
        caption={`Free units of ${item.name} per hour (out of ${item.quantity})`}
        dates={dates}
        remainingByDate={remainingByDate}
        quantity={item.quantity}
        unitsNeeded={unitsValid ? qty : 1}
        selection={selection}
        onCellClick={selectCell}
      />
      <p aria-live="polite" className="font-medium">
        {selection ? `Selected: ${formatSession(selection)}` : 'No time selected yet.'}
      </p>
    </>
  );
}
