import { HAZARD_LABELS } from '../lib/config.js';

const TONES = {
  moderate: 'bg-amber-100 text-amber-900 border-amber-300',
  high: 'bg-red-100 text-red-900 border-red-300',
};

/**
 * Hazard badge with text plus a decorative icon. Renders nothing for `none`.
 * @param {{ hazardLevel: 'none' | 'moderate' | 'high' }} props
 */
export default function HazardBadge({ hazardLevel }) {
  if (!TONES[hazardLevel]) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${TONES[hazardLevel]}`}
    >
      <span aria-hidden="true">⚠</span>
      {HAZARD_LABELS[hazardLevel]}
    </span>
  );
}
