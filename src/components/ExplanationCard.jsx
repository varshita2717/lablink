import { useId } from 'react';

/**
 * "Why this allocation" card. The text comes from templateExplanation (the formula's output);
 * an AI-written version is added in a later segment.
 * @param {{ text: string }} props
 */
export default function ExplanationCard({ text }) {
  const headingId = useId();
  return (
    <article
      aria-labelledby={headingId}
      className="rounded-lg border border-blue-200 bg-blue-50 p-4"
    >
      <h3 id={headingId} className="font-semibold text-blue-950">
        Why this allocation
      </h3>
      <p className="mt-2 text-slate-900">{text}</p>
      <p className="mt-2 text-xs text-slate-700">
        Summary generated from the scoring formula; the ranking comes from the formula.
      </p>
    </article>
  );
}
