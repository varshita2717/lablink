// Booking (SPEC Section 8). PURE helpers first, then Firestore loaders and writers.
import {
  collection,
  doc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { db } from './firebase.js';
import {
  FIRESTORE_IN_LIMIT,
  MAX_DAYS_AHEAD,
  MAX_HOURS_PER_DAY,
  MAX_ITEMS_PER_PLAN,
  SLOT_END_HOUR,
  SLOT_START_HOUR,
} from './config.js';
import { AppError, ERROR_CODES } from './errors.js';
import { daysBetween, isWorkingDay, today as todayInCampus } from './dates.js';

const invalid = (message) => new AppError(ERROR_CODES.INVALID_INPUT, message);
const slotId = (equipmentId, date) => `${equipmentId}_${date}`;

// ---------------------------------------------------------------- PURE

/**
 * PURE: validates booking entries (Section 8.5).
 * @param {{ equipment: { id: string, quantity: number }, date: string, startHour: number,
 *           endHour: number, qty: number }[]} entries
 * @param {string} today `YYYY-MM-DD`.
 * @returns {void}
 * @throws {AppError} INVALID_INPUT for bad shapes, hours, quantities or too many items;
 *   OUT_OF_HORIZON for past dates, weekends or dates beyond MAX_DAYS_AHEAD.
 */
export function validateEntries(entries, today) {
  if (!Array.isArray(entries) || entries.length === 0) throw invalid('No entries');
  for (const entry of entries) {
    const { equipment, date, startHour, endHour, qty } = entry ?? {};
    if (!equipment || typeof equipment.id !== 'string' || !Number.isInteger(equipment.quantity)) {
      throw invalid('Unknown equipment');
    }
    const offset = daysBetween(today, date); // throws INVALID_INPUT for a malformed date
    if (offset < 1 || offset > MAX_DAYS_AHEAD || !isWorkingDay(date)) {
      throw new AppError(ERROR_CODES.OUT_OF_HORIZON, `Date outside the horizon: ${date}`);
    }
    if (
      !Number.isInteger(startHour) ||
      !Number.isInteger(endHour) ||
      startHour < SLOT_START_HOUR ||
      endHour > SLOT_END_HOUR ||
      startHour >= endHour
    ) {
      throw invalid(`Invalid hours: ${startHour}-${endHour}`);
    }
    if (!Number.isInteger(qty) || qty < 1 || qty > equipment.quantity) {
      throw invalid(`Invalid quantity: ${qty}`);
    }
  }
  if (new Set(entries.map((e) => e.equipment.id)).size > MAX_ITEMS_PER_PLAN) {
    throw invalid('Too many items in one plan');
  }
}

/**
 * PURE: distinct booked hours per date.
 * @param {{ date: string, startHour: number, endHour: number }[]} ranges
 * @returns {Record<string, number[]>} Sorted hours per date.
 */
export function hoursByDate(ranges) {
  const map = {};
  for (const { date, startHour, endHour } of ranges) {
    map[date] ??= new Set();
    for (let hour = startHour; hour < endHour; hour += 1) map[date].add(hour);
  }
  return Object.fromEntries(
    Object.entries(map).map(([date, hours]) => [date, [...hours].sort((a, b) => a - b)]),
  );
}

/**
 * PURE: the per-student daily limit (Section 8.6.2).
 * @param {{ date: string, startHour: number, endHour: number }[]} existingBookings Confirmed.
 * @param {{ date: string, startHour: number, endHour: number }[]} entries New entries.
 * @returns {void}
 * @throws {AppError} LIMIT_EXCEEDED if any date would exceed MAX_HOURS_PER_DAY distinct hours.
 */
export function checkDailyLimit(existingBookings, entries) {
  const combined = hoursByDate([...existingBookings, ...entries]);
  for (const [date, hours] of Object.entries(combined)) {
    if (hours.length > MAX_HOURS_PER_DAY) {
      throw new AppError(ERROR_CODES.LIMIT_EXCEEDED, `Daily limit exceeded on ${date}`, { date });
    }
  }
}

/**
 * PURE: adds entries to slot hour maps, all-or-nothing (Section 8.4).
 * @param {Record<string, Record<string, number>>} hoursBySlot Current `hours` per slot ID.
 * @param {{ equipment: { id: string, quantity: number }, date: string, startHour: number,
 *           endHour: number, qty: number }[]} entries
 * @returns {Record<string, Record<string, number>>} New `hours` maps for every touched slot.
 * @throws {AppError} SLOT_FULL if any hour would exceed the equipment quantity (nothing is applied).
 */
export function applyEntriesToSlots(hoursBySlot, entries) {
  const updated = {};
  for (const { equipment, date, startHour, endHour, qty } of entries) {
    const id = slotId(equipment.id, date);
    updated[id] ??= { ...(hoursBySlot[id] ?? {}) };
    for (let hour = startHour; hour < endHour; hour += 1) {
      const booked = (updated[id][String(hour)] ?? 0) + qty;
      if (booked > equipment.quantity) {
        throw new AppError(ERROR_CODES.SLOT_FULL, `${equipment.id} is full at ${date} ${hour}:00`, {
          equipmentId: equipment.id,
          date,
          hour,
        });
      }
      updated[id][String(hour)] = booked;
    }
  }
  return updated;
}

/**
 * PURE: removes a booking's units from a slot hour map (never below 0).
 * @param {Record<string, number>} hours Current `hours` map.
 * @param {{ startHour: number, endHour: number, qty: number }} booking
 * @returns {Record<string, number>} The new map.
 */
export function releaseFromSlot(hours, { startHour, endHour, qty }) {
  const next = { ...hours };
  for (let hour = startHour; hour < endHour; hour += 1) {
    next[String(hour)] = Math.max(0, (next[String(hour)] ?? 0) - qty);
  }
  return next;
}

/**
 * PURE: turns per-day slot docs into remaining capacity.
 * @param {{ id: string, quantity: number }[]} equipment
 * @param {string[]} dates `YYYY-MM-DD`.
 * @param {{ equipmentId: string, date: string, hours?: Record<string, number> }[]} slotDocs
 * @returns {Record<string, Record<string, number[]>>} `availability[equipmentId][date][hour]`;
 *   only hours SLOT_START_HOUR..SLOT_END_HOUR-1 are filled. Missing docs or hours mean 0 booked.
 */
export function buildAvailability(equipment, dates, slotDocs) {
  const bookedByKey = new Map(slotDocs.map((s) => [slotId(s.equipmentId, s.date), s.hours ?? {}]));
  const availability = {};
  for (const item of equipment) {
    availability[item.id] = {};
    for (const date of dates) {
      const booked = bookedByKey.get(slotId(item.id, date)) ?? {};
      const remaining = [];
      for (let hour = SLOT_START_HOUR; hour < SLOT_END_HOUR; hour += 1) {
        remaining[hour] = Math.max(0, item.quantity - (booked[String(hour)] ?? 0));
      }
      availability[item.id][date] = remaining;
    }
  }
  return availability;
}

// ---------------------------------------------------------------- Firestore

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

/**
 * Loads a user's confirmed bookings between two dates (inclusive).
 * @param {string} uid
 * @param {string} fromDate
 * @param {string} toDate
 * @returns {Promise<object[]>}
 * @throws {FirebaseError} If Firestore rejects the query.
 */
export async function loadConfirmedBookings(uid, fromDate, toDate) {
  const snapshot = await getDocs(
    query(
      collection(db, 'bookings'),
      where('userUid', '==', uid),
      where('status', '==', 'confirmed'),
      where('date', '>=', fromDate),
      where('date', '<=', toDate),
    ),
  );
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Loads all of a user's bookings, newest date first.
 * @param {string} uid
 * @returns {Promise<object[]>}
 * @throws {FirebaseError} If Firestore rejects the query.
 */
export async function loadMyBookings(uid) {
  const snapshot = await getDocs(query(collection(db, 'bookings'), where('userUid', '==', uid)));
  return snapshot.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => b.date.localeCompare(a.date) || a.startHour - b.startHour);
}

/**
 * Transaction reads (all before any writes): active equipment and current slot hours.
 * @returns {Promise<{ freshEntries: object[], currentHours: Record<string, Record<string, number>> }>}
 * @throws {AppError} EQUIPMENT_INACTIVE if any item is missing or not active.
 */
async function readPlanState(tx, entries) {
  const equipmentIds = [...new Set(entries.map((e) => e.equipment.id))];
  const slotIds = [...new Set(entries.map((e) => slotId(e.equipment.id, e.date)))];
  const equipmentSnaps = await Promise.all(
    equipmentIds.map((id) => tx.get(doc(db, 'equipment', id))),
  );
  const slotSnaps = await Promise.all(slotIds.map((id) => tx.get(doc(db, 'slots', id))));
  const fresh = {};
  equipmentSnaps.forEach((snap, i) => {
    if (!snap.exists() || snap.data().status !== 'active') {
      throw new AppError(ERROR_CODES.EQUIPMENT_INACTIVE, `Inactive: ${equipmentIds[i]}`);
    }
    fresh[equipmentIds[i]] = { id: equipmentIds[i], ...snap.data() };
  });
  const currentHours = Object.fromEntries(
    slotSnaps.map((snap, i) => [slotIds[i], snap.exists() ? (snap.data().hours ?? {}) : {}]),
  );
  return {
    freshEntries: entries.map((e) => ({ ...e, equipment: fresh[e.equipment.id] })),
    currentHours,
  };
}

/**
 * Transaction writes: updated slot docs and one confirmed booking per entry.
 * @returns {string[]} The new booking IDs.
 */
function writePlan(tx, { user, requestId, projectId, freshEntries, updatedHours }) {
  for (const e of freshEntries) {
    const id = slotId(e.equipment.id, e.date);
    tx.set(doc(db, 'slots', id), {
      equipmentId: e.equipment.id,
      date: e.date,
      hours: updatedHours[id],
      updatedAt: serverTimestamp(),
    });
  }
  return freshEntries.map((e) => {
    const ref = doc(collection(db, 'bookings'));
    tx.set(ref, {
      equipmentId: e.equipment.id,
      equipmentName: e.equipment.name,
      date: e.date,
      startHour: e.startHour,
      endHour: e.endHour,
      qty: e.qty,
      userUid: user.uid,
      userName: user.name,
      requestId,
      projectId,
      status: 'confirmed',
      createdAt: serverTimestamp(),
    });
    return ref.id;
  });
}

/**
 * Books a plan all-or-nothing (Section 8.6).
 * @param {{ user: { uid: string, name: string }, requestId?: string | null,
 *           projectId?: string | null, entries: object[],
 *           additionalWrites?: (tx: import('firebase/firestore').Transaction) => void }} plan
 *   `user` is the student the bookings belong to (staff may book on a student's behalf on approval).
 * @returns {Promise<string[]>} The new booking IDs.
 * @throws {AppError} INVALID_INPUT, OUT_OF_HORIZON, LIMIT_EXCEEDED, EQUIPMENT_INACTIVE or SLOT_FULL;
 *   FirebaseError if rules reject a write.
 */
export async function bookPlan({
  user,
  requestId = null,
  projectId = null,
  entries,
  additionalWrites,
}) {
  validateEntries(entries, todayInCampus());

  // Client transactions cannot run queries, so the daily limit is checked just before the
  // transaction. A tiny race (two tabs booking at the same instant) is accepted for this demo.
  const dates = entries.map((e) => e.date).sort();
  const existing = await loadConfirmedBookings(user.uid, dates[0], dates[dates.length - 1]);
  checkDailyLimit(existing, entries);

  return runTransaction(db, async (tx) => {
    const { freshEntries, currentHours } = await readPlanState(tx, entries);
    const updatedHours = applyEntriesToSlots(currentHours, freshEntries); // throws SLOT_FULL
    const bookingIds = writePlan(tx, { user, requestId, projectId, freshEntries, updatedHours });
    additionalWrites?.(tx);
    return bookingIds;
  });
}

/**
 * Cancels the owner's future confirmed booking and frees its capacity, in one transaction.
 * @param {string} bookingId
 * @param {{ uid: string }} user The signed-in user.
 * @returns {Promise<void>}
 * @throws {AppError} NOT_AUTHORIZED if not the owner's confirmed booking; OUT_OF_HORIZON if it
 *   is not in the future; FirebaseError if rules reject the write.
 */
export async function cancelBooking(bookingId, user) {
  await runTransaction(db, async (tx) => {
    const bookingRef = doc(db, 'bookings', bookingId);
    const bookingSnap = await tx.get(bookingRef);
    const booking = bookingSnap.exists() ? bookingSnap.data() : null;
    if (!booking || booking.userUid !== user.uid || booking.status !== 'confirmed') {
      throw new AppError(ERROR_CODES.NOT_AUTHORIZED, 'Not a cancellable booking');
    }
    if (daysBetween(todayInCampus(), booking.date) < 1) {
      throw new AppError(ERROR_CODES.OUT_OF_HORIZON, 'Only future bookings can be cancelled');
    }
    const slotRef = doc(db, 'slots', slotId(booking.equipmentId, booking.date));
    const slotSnap = await tx.get(slotRef);
    const hours = releaseFromSlot(slotSnap.exists() ? (slotSnap.data().hours ?? {}) : {}, booking);
    tx.set(slotRef, {
      equipmentId: booking.equipmentId,
      date: booking.date,
      hours,
      updatedAt: serverTimestamp(),
    });
    tx.update(bookingRef, { status: 'cancelled', cancelledAt: serverTimestamp() });
  });
}
