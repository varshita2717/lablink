import { STATUS_LABELS } from '../lib/config.js';

// Light backgrounds with 800/900 text keep contrast above 4.5:1. Colour is never the only cue.
const TONES = {
  pending: 'bg-amber-100 text-amber-900 border-amber-300',
  approved: 'bg-green-100 text-green-900 border-green-300',
  confirmed: 'bg-green-100 text-green-900 border-green-300',
  rejected: 'bg-red-100 text-red-900 border-red-300',
  conflict_lost: 'bg-orange-100 text-orange-900 border-orange-300',
  changes_requested: 'bg-blue-100 text-blue-900 border-blue-300',
  cancelled: 'bg-slate-100 text-slate-800 border-slate-300',
  proposed: 'bg-purple-100 text-purple-900 border-purple-300',
  quiet: 'bg-teal-100 text-teal-900 border-teal-300',
  moderate: 'bg-slate-100 text-slate-800 border-slate-300',
  busy: 'bg-rose-100 text-rose-900 border-rose-300',
};

/**
 * Text badge for a status, always showing its label.
 * @param {{ status: string, label?: string }} props
 */
export default function StatusBadge({ status, label }) {
  const tone = TONES[status] ?? TONES.cancelled;
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${tone}`}
    >
      {label ?? STATUS_LABELS[status] ?? status}
    </span>
  );
}
