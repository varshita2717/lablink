// Cached loaders for reference data, plus the PURE catalogue filter.
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from './firebase.js';
import { INVENTORY_CACHE_MS, SLOT_END_HOUR, SLOT_START_HOUR } from './config.js';

const cache = new Map();

/**
 * Returns a cached value, loading it if missing or older than INVENTORY_CACHE_MS.
 * Concurrent callers share one in-flight request; a failed load is not cached.
 * @param {string} key
 * @param {() => Promise<any>} loader
 * @returns {Promise<any>}
 */
function cached(key, loader) {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.at < INVENTORY_CACHE_MS) return entry.promise;
  const promise = loader().catch((error) => {
    cache.delete(key);
    throw error;
  });
  cache.set(key, { at: Date.now(), promise });
  return promise;
}

const toList = (snapshot) => snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
const byName = (a, b) => (a.name ?? a.title).localeCompare(b.name ?? b.title);

/**
 * Loads active equipment (cached). Proposed and disabled items are never returned.
 * @returns {Promise<object[]>} Equipment docs with `id`, sorted by name.
 * @throws {FirebaseError} If Firestore rejects the query.
 */
export function loadActiveEquipment() {
  return cached('equipment', async () => {
    const snapshot = await getDocs(
      query(collection(db, 'equipment'), where('status', '==', 'active')),
    );
    return toList(snapshot).sort(byName);
  });
}

/**
 * Loads all experiments (cached).
 * @returns {Promise<object[]>}
 * @throws {FirebaseError} If Firestore rejects the query.
 */
export function loadExperiments() {
  return cached('experiments', async () =>
    toList(await getDocs(collection(db, 'experiments'))).sort(byName),
  );
}

/**
 * Loads all labs (cached).
 * @returns {Promise<object[]>}
 * @throws {FirebaseError} If Firestore rejects the query.
 */
export function loadLabs() {
  return cached('labs', async () => toList(await getDocs(collection(db, 'labs'))).sort(byName));
}

/** Clears the inventory cache; call after any admin write to equipment, experiments or labs. */
export function invalidateInventory() {
  cache.clear();
}

/**
 * Checks whether an item has at least one free unit in any bookable hour of a date.
 * @param {{ id: string, quantity: number }} item
 * @param {Record<string, Record<string, number[]>>} availability
 * @param {string} date
 * @returns {boolean}
 */
export function isFreeOn(item, availability, date) {
  const remaining = availability?.[item.id]?.[date];
  for (let hour = SLOT_START_HOUR; hour < SLOT_END_HOUR; hour += 1) {
    if ((remaining?.[hour] ?? item.quantity) >= 1) return true;
  }
  return false;
}

/**
 * PURE: filters the catalogue client-side. Empty filter values match everything.
 * The text query matches every word against name, category, description, tags, lab and department.
 * @param {object[]} equipment Active equipment.
 * @param {{ query?: string, department?: string, category?: string, accessLevel?: string,
 *           freeOn?: string }} filters
 * @param {Record<string, Record<string, number[]>>} [availability] Needed only for `freeOn`.
 * @returns {object[]} Matching items, in input order.
 */
export function filterEquipment(equipment, filters, availability) {
  const words = (filters.query ?? '').toLowerCase().split(/\s+/).filter(Boolean);
  return equipment.filter((item) => {
    if (filters.department && item.department !== filters.department) return false;
    if (filters.category && item.category !== filters.category) return false;
    if (filters.accessLevel && item.accessLevel !== filters.accessLevel) return false;
    if (filters.freeOn && !isFreeOn(item, availability, filters.freeOn)) return false;
    if (words.length === 0) return true;
    const haystack = [
      item.name,
      item.category,
      item.description,
      item.labName,
      item.department,
      ...(item.tags ?? []),
    ]
      .join(' ')
      .toLowerCase();
    return words.every((word) => haystack.includes(word));
  });
}
