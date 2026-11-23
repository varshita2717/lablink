// Cached loaders for reference data, plus the PURE catalogue filter.
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from './firebase.js';
import {
  INVENTORY_CACHE_MS,
  MAX_SEARCH_RESULTS,
  SLOT_END_HOUR,
  SLOT_START_HOUR,
} from './config.js';

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

/**
 * PURE: active substitutes for each requested item (same non-null equivalentGroup, other ID).
 * @param {object[]} equipment Active equipment.
 * @param {string[]} equipmentIds Items in the plan or request.
 * @returns {Record<string, { equipmentId: string, name: string }[]>} Only items with substitutes.
 */
export function buildSubstitutes(equipment, equipmentIds) {
  const byId = Object.fromEntries(equipment.map((item) => [item.id, item]));
  const result = {};
  for (const id of new Set(equipmentIds)) {
    const group = byId[id]?.equivalentGroup;
    if (!group) continue;
    const others = equipment
      .filter(
        (item) => item.equivalentGroup === group && item.id !== id && item.status === 'active',
      )
      .map((item) => ({ equipmentId: item.id, name: item.name }));
    if (others.length) result[id] = others;
  }
  return result;
}

/**
 * PURE: autocomplete suggestions for the catalogue search. Case-insensitive; ranks names that start
 * with the query, then names containing it, then tag matches, then category matches. Items that
 * are disabled or proposed are never suggested. Ties keep the input order.
 * @param {string} query Text typed by the user.
 * @param {object[]} equipmentList Equipment (e.g. the cached active list).
 * @param {number} [limit] Maximum suggestions.
 * @returns {object[]} Matching items, best first.
 */
export function suggestEquipment(query, equipmentList, limit = MAX_SEARCH_RESULTS) {
  const text = String(query ?? '')
    .trim()
    .toLowerCase();
  if (!text) return [];
  const rankOf = (item) => {
    const name = item.name.toLowerCase();
    if (name.startsWith(text)) return 0;
    if (name.includes(text)) return 1;
    if ((item.tags ?? []).some((tag) => tag.toLowerCase().includes(text))) return 2;
    if ((item.category ?? '').toLowerCase().includes(text)) return 3;
    return null;
  };
  return equipmentList
    .filter((item) => (item.status ?? 'active') === 'active')
    .map((item, index) => ({ item, index, rank: rankOf(item) }))
    .filter((entry) => entry.rank !== null)
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .slice(0, limit)
    .map((entry) => entry.item);
}
