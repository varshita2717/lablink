// PURE: no Firebase, no React.
import {
  HOURS_PER_DAY,
  SLOT_END_HOUR,
  SLOT_START_HOUR,
  UTILISATION_LABELS,
  UTIL_BUSY,
  UTIL_QUIET,
} from './config.js';

/**
 * Maps a utilisation rate to its label.
 * @param {number} rate Booked share of capacity, 0-1.
 * @returns {string} "Quiet" (< UTIL_QUIET), "Moderate" (< UTIL_BUSY) or "Busy".
 */
export function utilisationLabel(rate) {
  if (rate < UTIL_QUIET) return UTILISATION_LABELS.quiet;
  if (rate < UTIL_BUSY) return UTILISATION_LABELS.moderate;
  return UTILISATION_LABELS.busy;
}

/**
 * Sums booked units over the bookable hours of one equipment item.
 * @param {{ id: string, quantity: number }} item
 * @param {Record<string, Record<string, number[]>>} availability
 * @param {string[]} dates
 * @returns {number}
 */
function bookedHoursFor(item, availability, dates) {
  let booked = 0;
  for (const date of dates) {
    const remaining = availability?.[item.id]?.[date];
    for (let hour = SLOT_START_HOUR; hour < SLOT_END_HOUR; hour += 1) {
      const free = remaining?.[hour] ?? item.quantity;
      booked += Math.max(0, item.quantity - free);
    }
  }
  return booked;
}

/**
 * Computes utilisation per equipment over the given working dates (SPEC Section 12).
 * A missing availability entry means nothing is booked.
 * @param {{ equipment: { id: string, name: string, quantity: number }[],
 *           availability: Record<string, Record<string, number[]>>, dates: string[] }} input
 * @returns {{ equipmentId: string, name: string, bookedHours: number, capacityHours: number,
 *             rate: number, label: string }[]}
 */
export function computeUtilisation({ equipment, availability, dates }) {
  return equipment.map((item) => {
    const capacityHours = item.quantity * HOURS_PER_DAY * dates.length;
    const bookedHours = bookedHoursFor(item, availability, dates);
    const rate = capacityHours === 0 ? 0 : bookedHours / capacityHours;
    return {
      equipmentId: item.id,
      name: item.name,
      bookedHours,
      capacityHours,
      rate,
      label: utilisationLabel(rate),
    };
  });
}
