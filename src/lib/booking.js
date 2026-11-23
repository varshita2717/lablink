// Booking: availability loading (Firestore) and its PURE builder.
// validateEntries, bookPlan and cancelBooking are added in segment F3.
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from './firebase.js';
import { FIRESTORE_IN_LIMIT, SLOT_END_HOUR, SLOT_START_HOUR } from './config.js';

/**
 * PURE: turns per-day slot docs into remaining capacity.
 * @param {{ id: string, quantity: number }[]} equipment
 * @param {string[]} dates `YYYY-MM-DD`.
 * @param {{ equipmentId: string, date: string, hours?: Record<string, number> }[]} slotDocs
 * @returns {Record<string, Record<string, number[]>>} `availability[equipmentId][date][hour]`;
 *   only hours SLOT_START_HOUR..SLOT_END_HOUR-1 are filled. Missing docs or hours mean 0 booked.
 */
export function buildAvailability(equipment, dates, slotDocs) {
  const bookedByKey = new Map(slotDocs.map((s) => [`${s.equipmentId}_${s.date}`, s.hours ?? {}]));
  const availability = {};
  for (const item of equipment) {
    availability[item.id] = {};
    for (const date of dates) {
      const booked = bookedByKey.get(`${item.id}_${date}`) ?? {};
      const remaining = [];
      for (let hour = SLOT_START_HOUR; hour < SLOT_END_HOUR; hour += 1) {
        remaining[hour] = Math.max(0, item.quantity - (booked[String(hour)] ?? 0));
      }
      availability[item.id][date] = remaining;
    }
  }
  return availability;
}

/**
 * Loads remaining capacity for equipment over dates, with one query per batch of up to
 * FIRESTORE_IN_LIMIT equipment IDs (`equipmentId in [...]` plus the date range).
 * @param {{ id: string, quantity: number }[]} equipment Items to check (quantity is the capacity).
 * @param {string[]} dates Sorted `YYYY-MM-DD` dates.
 * @returns {Promise<Record<string, Record<string, number[]>>>} See buildAvailability.
 * @throws {FirebaseError} If Firestore rejects a query.
 */
export async function loadAvailability(equipment, dates) {
  if (equipment.length === 0 || dates.length === 0) return buildAvailability(equipment, dates, []);
  const ids = equipment.map((item) => item.id);
  const batches = [];
  for (let i = 0; i < ids.length; i += FIRESTORE_IN_LIMIT) {
    batches.push(ids.slice(i, i + FIRESTORE_IN_LIMIT));
  }
  const snapshots = await Promise.all(
    batches.map((batch) =>
      getDocs(
        query(
          collection(db, 'slots'),
          where('equipmentId', 'in', batch),
          where('date', '>=', dates[0]),
          where('date', '<=', dates[dates.length - 1]),
        ),
      ),
    ),
  );
  const slotDocs = snapshots.flatMap((snapshot) => snapshot.docs.map((d) => d.data()));
  return buildAvailability(equipment, dates, slotDocs);
}
