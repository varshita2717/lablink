// recommend_equipment (SPEC 13.3): a separate JSON-mode model call, a PURE parser, and enrichment
// from data. The model only picks IDs, quantities and short reasons; everything else comes from data.
import {
  MAX_RECOMMENDED_ITEMS,
  MAX_REASON_TEXT,
  MAX_SEARCH_RESULTS,
  MIN_SEARCH_WORD_LENGTH,
  SEARCH_WEIGHTS,
} from '../config.js';
import { collectSafetyNotes, needsApproval } from '../access.js';

const FENCE = /^\s*```(?:json)?\s*|\s*```\s*$/g;
const EMPTY = { matchedExperimentId: null, items: [], valid: false };

const clip = (value) => (typeof value === 'string' ? value.trim().slice(0, MAX_REASON_TEXT) : '');

/**
 * PURE: parses and sanitises the model's recommendation JSON.
 * Strips code fences, drops unknown equipment IDs and duplicates, caps qty at the item's quantity
 * (minimum 1), cuts `role` and `reason` to MAX_REASON_TEXT characters and keeps at most
 * MAX_RECOMMENDED_ITEMS items.
 * @param {string} raw Model output.
 * @param {Record<string, { quantity: number }>} equipmentById Active equipment.
 * @param {Record<string, unknown>} [experimentsById] Known experiments; unknown IDs become null.
 * @returns {{ matchedExperimentId: string | null, items: { equipmentId: string, qty: number,
 *             role: string, reason: string }[], valid: boolean }} `valid` is false when the JSON
 *             could not be parsed (callers then use the keyword fallback).
 */
export function parseRecommendation(raw, equipmentById, experimentsById = {}) {
  let data;
  try {
    data = JSON.parse(String(raw ?? '').replace(FENCE, ''));
  } catch {
    return { ...EMPTY };
  }
  if (!data || typeof data !== 'object') return { ...EMPTY };
  const seen = new Set();
  const items = [];
  for (const item of Array.isArray(data.items) ? data.items : []) {
    const id = item?.equipmentId;
    if (typeof id !== 'string' || !Object.hasOwn(equipmentById, id) || seen.has(id)) continue;
    seen.add(id);
    const requested = Number.isFinite(item.qty) ? Math.floor(item.qty) : 1;
    items.push({
      equipmentId: id,
      qty: Math.min(Math.max(requested, 1), equipmentById[id].quantity),
      role: clip(item.role),
      reason: clip(item.reason),
    });
    if (items.length === MAX_RECOMMENDED_ITEMS) break;
  }
  const experimentId = data.matchedExperimentId;
  return {
    matchedExperimentId:
      typeof experimentId === 'string' && Object.hasOwn(experimentsById, experimentId)
        ? experimentId
        : null,
    items,
    valid: true,
  };
}

/**
 * PURE: deterministic keyword and tag scoring over active equipment (the recommendation fallback).
 * Name and tag matches score higher than description matches.
 * @param {string} text Search words.
 * @param {object[]} equipment Active equipment.
 * @returns {object[]} Up to MAX_SEARCH_RESULTS items, best first (ties keep input order).
 */
export function searchEquipment(text, equipment) {
  const words = String(text ?? '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= MIN_SEARCH_WORD_LENGTH);
  if (words.length === 0) return [];
  const scored = equipment.map((item, index) => {
    const name = item.name.toLowerCase();
    const tags = (item.tags ?? []).join(' ').toLowerCase();
    const rest = `${item.category} ${item.description}`.toLowerCase();
    const score = words.reduce(
      (sum, word) =>
        sum +
        (name.includes(word) ? SEARCH_WEIGHTS.name : 0) +
        (tags.includes(word) ? SEARCH_WEIGHTS.tags : 0) +
        (rest.includes(word) ? SEARCH_WEIGHTS.text : 0),
      0,
    );
    return { item, score, index };
  });
  return scored
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, MAX_SEARCH_RESULTS)
    .map((entry) => entry.item);
}

/** True if some bookable hour on the date has at least `qty` units free. */
function freeAt(availability, equipmentId, date, qty) {
  return (availability?.[equipmentId]?.[date] ?? []).some((remaining) => remaining >= qty);
}

/**
 * PURE: adds data-derived fields to recommended items: access and hazard levels, availability on
 * the next working day, free substitutes, safety notes and needsApproval (never from the model).
 * @param {{ matchedExperimentId: string | null, items: object[] }} parsed
 * @param {{ equipmentById: Record<string, object>, experimentsById: Record<string, object>,
 *           availability: object, date: string,
 *           substitutesById: Record<string, { equipmentId: string, name: string }[]> }} data
 * @returns {{ matchedExperiment: { id: string, title: string } | null, date: string,
 *             items: object[], safetyNotes: string[], needsApproval: boolean }}
 */
export function enrichRecommendation(parsed, data) {
  const { equipmentById, experimentsById, availability, date, substitutesById } = data;
  const items = parsed.items.map(({ equipmentId, qty, role, reason }) => {
    const equipment = equipmentById[equipmentId];
    return {
      equipmentId,
      name: equipment.name,
      qty,
      role,
      reason,
      accessLevel: equipment.accessLevel,
      hazardLevel: equipment.hazardLevel,
      availableTomorrow: freeAt(availability, equipmentId, date, qty),
      substitutes: (substitutesById[equipmentId] ?? [])
        .filter((sub) => freeAt(availability, sub.equipmentId, date, qty))
        .map((sub) => ({ equipmentId: sub.equipmentId, name: sub.name })),
    };
  });
  const experiment = parsed.matchedExperimentId
    ? experimentsById[parsed.matchedExperimentId]
    : null;
  const equipment = items.map((item) => equipmentById[item.equipmentId]);
  return {
    matchedExperiment: experiment ? { id: experiment.id, title: experiment.title } : null,
    date,
    items,
    safetyNotes: collectSafetyNotes(equipment, experiment),
    needsApproval: needsApproval(equipment),
  };
}

/**
 * Runs the recommendation: one JSON-mode model call, parsed and enriched from data. Falls back to
 * keyword search (`aiMatching: "unavailable"`) if the call fails or returns nothing usable.
 * @param {string} description Validated project description.
 * @param {{ equipment: object[], experiments: object[], availability: object, date: string,
 *           substitutesById: object, generateJson: (description: string) => Promise<string> }} deps
 * @returns {Promise<object>} enrichRecommendation output plus `aiMatching: "ok" | "unavailable"`.
 */
export async function recommendEquipment(description, deps) {
  const equipmentById = Object.fromEntries(deps.equipment.map((item) => [item.id, item]));
  const experimentsById = Object.fromEntries(deps.experiments.map((exp) => [exp.id, exp]));
  const data = { ...deps, equipmentById, experimentsById };
  let parsed = { valid: false, items: [] };
  try {
    parsed = parseRecommendation(
      await deps.generateJson(description),
      equipmentById,
      experimentsById,
    );
  } catch (error) {
    console.error('Recommendation call failed; using keyword search', error);
  }
  if (parsed.valid && parsed.items.length > 0) {
    return { ...enrichRecommendation(parsed, data), aiMatching: 'ok' };
  }
  const fallback = searchEquipment(description, deps.equipment).map((item) => ({
    equipmentId: item.id,
    qty: 1,
    role: '',
    reason: 'Matched by keyword search',
  }));
  return {
    ...enrichRecommendation({ matchedExperimentId: null, items: fallback }, data),
    aiMatching: 'unavailable',
  };
}
