import { ACCESS_LABELS } from '../lib/config.js';

const TONES = {
  open: 'bg-green-100 text-green-900 border-green-300',
  approval: 'bg-amber-100 text-amber-900 border-amber-300',
};

/**
 * Shows whether equipment books instantly or needs faculty approval.
 * @param {{ accessLevel: 'open' | 'approval' }} props
 */
export default function AccessBadge({ accessLevel }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${TONES[accessLevel]}`}
    >
      {ACCESS_LABELS[accessLevel]}
    </span>
  );
}
