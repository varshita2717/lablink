import { roundScore } from '../lib/format.js';
import AlternativesList from './AlternativesList.jsx';

const show = (value) => roundScore(value).toFixed(2);

/**
 * Ranking of a conflict group with the score breakdown and the outcome in text.
 * @param {{ resolution: { ranking: object[] }, caption: string }} props
 */
export default function RankingTable({ resolution, caption }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse text-left text-sm">
        <caption className="pb-2 text-left font-semibold">{caption}</caption>
        <thead>
          <tr className="border-b border-slate-300">
            {[
              'Rank',
              'Student',
              'Project',
              'Urgency',
              'Fairness',
              'Stage',
              'Total',
              'Outcome',
              'Alternatives',
            ].map((heading) => (
              <th key={heading} scope="col" className="px-2 py-1 font-semibold">
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {resolution.ranking.map((entry) => (
            <tr key={entry.requestId} className="border-b border-slate-200 align-top">
              <td className="px-2 py-2">{entry.rank}</td>
              <th scope="row" className="px-2 py-2 font-semibold">
                {entry.studentName}
              </th>
              <td className="px-2 py-2">{entry.projectTitle}</td>
              <td className="px-2 py-2">{show(entry.score.urgency)}</td>
              <td className="px-2 py-2">{show(entry.score.fairness)}</td>
              <td className="px-2 py-2">{show(entry.score.stage)}</td>
              <td className="px-2 py-2 font-semibold">{show(entry.score.total)}</td>
              <td className="px-2 py-2">{entry.isWinner ? 'Allocated' : 'Not allocated'}</td>
              <td className="px-2 py-2">
                {entry.isWinner ? '—' : <AlternativesList alternatives={entry.alternatives} />}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
