// PURE: no Firebase, no React. Access tiers and hazard rules (SPEC Section 9).

const NOTE_LEVELS = ['moderate', 'high'];

/**
 * True if any item needs faculty approval: approval access or high hazard.
 * @param {{ accessLevel: string, hazardLevel: string }[]} items Equipment (from data, never the model).
 * @returns {boolean}
 */
export function needsApproval(items) {
  return items.some((item) => item.accessLevel === 'approval' || item.hazardLevel === 'high');
}

/**
 * Collects the distinct safety notes of moderate- or high-hazard items and an optional experiment.
 * @param {{ hazardLevel: string, safetyNote?: string }[]} items
 * @param {{ hazardLevel: string, safetyNote?: string } | null} [experiment]
 * @returns {string[]} Unique, non-empty notes in first-seen order.
 */
export function collectSafetyNotes(items, experiment = null) {
  const sources = experiment ? [experiment, ...items] : items;
  const notes = sources
    .filter((source) => NOTE_LEVELS.includes(source.hazardLevel))
    .map((source) => (source.safetyNote ?? '').trim())
    .filter(Boolean);
  return [...new Set(notes)];
}
