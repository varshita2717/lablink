import AlternativesList from './AlternativesList.jsx';
import RankMedal from './RankMedal.jsx';
import ScoreBar from './ScoreBar.jsx';

const HEADINGS = [
  'Rank',
  'Student',
  'Project',
  'Urgency',
  'Fairness',
  'Stage',
  'Total',
  'Outcome',
  'Alternatives',
];

/**
 * Ranking of a conflict group: medals, score bars with numbers, and the outcome in text.
 * @param {{ resolution: { ranking: object[] }, caption: string }} props
 */
export default function RankingTable({ resolution, caption }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="min-w-full border-collapse text-left text-sm">
        <caption className="bg-cream px-3 py-2 text-left font-semibold text-ink">{caption}</caption>
        <thead className="bg-cream text-xs tracking-wide text-muted uppercase">
          <tr>
            {HEADINGS.map((heading) => (
              <th key={heading} scope="col" className="px-3 py-2 font-semibold">
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line bg-surface">
          {resolution.ranking.map((entry) => (
            <tr key={entry.requestId} className="align-top">
              <td className="px-3 py-3">
                <RankMedal rank={entry.rank} />
              </td>
              <th scope="row" className="px-3 py-3 font-semibold text-ink">
                {entry.studentName}
              </th>
              <td className="px-3 py-3 text-muted">{entry.projectTitle}</td>
              <td className="px-3 py-3">
                <ScoreBar value={entry.score.urgency} />
              </td>
              <td className="px-3 py-3">
                <ScoreBar value={entry.score.fairness} tone="teal" />
              </td>
              <td className="px-3 py-3">
                <ScoreBar value={entry.score.stage} tone="slate" />
              </td>
              <td className="px-3 py-3">
                <ScoreBar value={entry.score.total} strong />
              </td>
              <td className="px-3 py-3">
                <span
                  className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${
                    entry.isWinner
                      ? 'border-line bg-cream text-maroon'
                      : 'border-orange-300 bg-orange-50 text-orange-900'
                  }`}
                >
                  {entry.isWinner ? 'Allocated' : 'Not allocated'}
                </span>
              </td>
              <td className="px-3 py-3 text-muted">
                {entry.isWinner ? '—' : <AlternativesList alternatives={entry.alternatives} />}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
