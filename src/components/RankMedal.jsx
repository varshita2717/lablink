const MEDALS = {
  1: 'border-amber-400 bg-amber-100 text-amber-900',
  2: 'border-slate-400 bg-slate-100 text-slate-800',
  3: 'border-orange-400 bg-orange-100 text-orange-900',
};

/**
 * Rank shown as a numbered medal (gold, silver, bronze for 1-3). The number is always visible.
 * @param {{ rank: number }} props
 */
export default function RankMedal({ rank }) {
  const style = MEDALS[rank] ?? 'border-slate-300 bg-white text-slate-700';
  return (
    <span
      className={`inline-flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-bold ${style}`}
    >
      <span className="sr-only">Rank </span>
      {rank}
    </span>
  );
}
