const MEDALS = {
  1: 'border-amber-400 bg-amber-100 text-amber-900',
  2: 'border-maroon bg-cream text-ink',
  3: 'border-orange-400 bg-orange-100 text-orange-900',
};

/**
 * Rank shown as a numbered medal (gold, silver, bronze for 1-3). The number is always visible.
 * @param {{ rank: number }} props
 */
export default function RankMedal({ rank }) {
  const style = MEDALS[rank] ?? 'border-line bg-surface text-muted';
  return (
    <span
      className={`inline-flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-bold ${style}`}
    >
      <span className="sr-only">Rank </span>
      {rank}
    </span>
  );
}
