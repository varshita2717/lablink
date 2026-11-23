import { roundScore } from '../lib/format.js';

/**
 * A 0-1 score as text plus a decorative bar (the number carries the meaning, not the colour).
 * @param {{ value: number, tone?: 'indigo' | 'teal' | 'slate', strong?: boolean }} props
 */
export default function ScoreBar({ value, tone = 'indigo', strong = false }) {
  const fills = { indigo: 'bg-indigo-500', teal: 'bg-teal-600', slate: 'bg-slate-500' };
  const percent = Math.round(Math.min(Math.max(value, 0), 1) * 100);
  return (
    <div className="flex min-w-24 items-center gap-2">
      <span
        className={`w-9 tabular-nums ${strong ? 'font-bold text-slate-900' : 'text-slate-800'}`}
      >
        {roundScore(value).toFixed(2)}
      </span>
      <span aria-hidden="true" className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
        <span
          className={`block h-full rounded-full ${fills[tone]}`}
          style={{ width: `${percent}%` }}
        />
      </span>
    </div>
  );
}
