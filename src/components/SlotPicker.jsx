import { SLOT_END_HOUR, SLOT_START_HOUR } from '../lib/config.js';
import { formatDate, formatHour } from '../lib/format.js';

const HOURS = Array.from(
  { length: SLOT_END_HOUR - SLOT_START_HOUR },
  (_, i) => SLOT_START_HOUR + i,
);

const isSelected = (selection, date, hour) =>
  selection?.date === date && hour >= selection.startHour && hour < selection.endHour;

/**
 * Hour × date availability grid (SPEC Section 2.5). Each cell is a button announcing its date,
 * hour range and free units; full cells are disabled. Selection is controlled by the parent.
 * @param {{ caption: string, dates: string[], remainingByDate: Record<string, number[]>,
 *           quantity: number, unitsNeeded?: number,
 *           selection?: { date: string, startHour: number, endHour: number } | null,
 *           onCellClick?: (date: string, hour: number) => void }} props
 */
export default function SlotPicker({
  caption,
  dates,
  remainingByDate,
  quantity,
  unitsNeeded = 1,
  selection = null,
  onCellClick,
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="min-w-full border-collapse text-sm">
        <caption className="px-3 py-2 text-left font-semibold text-slate-900">{caption}</caption>
        <thead>
          <tr>
            <th scope="col" className="sticky left-0 bg-white px-2 py-1 text-left">
              Time
            </th>
            {dates.map((date) => (
              <th key={date} scope="col" className="px-1 py-1 font-semibold whitespace-nowrap">
                {formatDate(date)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {HOURS.map((hour) => (
            <tr key={hour}>
              <th
                scope="row"
                className="sticky left-0 bg-white px-2 py-1 text-left whitespace-nowrap"
              >
                {formatHour(hour)}
              </th>
              {dates.map((date) => {
                const remaining = remainingByDate[date]?.[hour] ?? 0;
                const selected = isSelected(selection, date, hour);
                const unavailable = remaining < unitsNeeded;
                return (
                  <td key={date} className="p-0.5">
                    <button
                      type="button"
                      aria-label={`${formatDate(date)}, ${formatHour(hour)} to ${formatHour(hour + 1)}, ${remaining} of ${quantity} free`}
                      aria-pressed={selected}
                      disabled={unavailable}
                      onClick={() => onCellClick?.(date, hour)}
                      className={`min-h-8 w-full min-w-16 rounded border px-1 py-1 text-xs font-medium ${
                        selected
                          ? 'border-indigo-700 bg-indigo-600 text-white'
                          : unavailable
                            ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-700'
                            : 'border-green-300 bg-green-50 text-green-900 hover:bg-green-100'
                      }`}
                    >
                      {remaining === 0 ? 'Full' : `${remaining} free`}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
