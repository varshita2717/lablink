import { useCallback, useState } from 'react';
import { MAX_HOURS_PER_DAY } from '../lib/config.js';

/**
 * Next selection after a cell click: extend or shrink a contiguous range on one date
 * (up to MAX_HOURS_PER_DAY hours), or start a new one-hour selection.
 * @param {{ date: string, startHour: number, endHour: number } | null} current
 * @param {string} date
 * @param {number} hour
 * @returns {{ date: string, startHour: number, endHour: number } | null}
 */
export function nextSelection(current, date, hour) {
  const single = { date, startHour: hour, endHour: hour + 1 };
  if (!current || current.date !== date) return single;
  const { startHour, endHour } = current;
  const length = endHour - startHour;
  if (length === 1 && hour === startHour) return null;
  if (hour === endHour && length < MAX_HOURS_PER_DAY) return { date, startHour, endHour: hour + 1 };
  if (hour === startHour - 1 && length < MAX_HOURS_PER_DAY)
    return { date, startHour: hour, endHour };
  if (hour === startHour) return { date, startHour: hour + 1, endHour };
  if (hour === endHour - 1) return { date, startHour, endHour: hour };
  return single;
}

/**
 * Selection state for picking one contiguous time range and a number of units on the SlotPicker.
 * @param {{ quantity: number }} item The equipment (quantity bounds the units).
 * @returns {{ selection: object | null, selectCell: (date: string, hour: number) => void,
 *             clear: () => void, units: string, setUnits: (value: string) => void,
 *             qty: number, unitsValid: boolean }}
 */
export default function useSlotSelection(item) {
  const [selection, setSelection] = useState(null);
  const [units, setUnits] = useState('1');
  const selectCell = useCallback(
    (date, hour) => setSelection((current) => nextSelection(current, date, hour)),
    [],
  );
  const clear = useCallback(() => setSelection(null), []);
  const qty = Number(units);
  const unitsValid = Number.isInteger(qty) && qty >= 1 && qty <= item.quantity;
  return { selection, selectCell, clear, units, setUnits, qty, unitsValid };
}
