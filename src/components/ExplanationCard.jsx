import { useId } from 'react';

/**
 * "Why this allocation" card. The text comes from templateExplanation (the formula's output);
 * an AI-written version is added in a later segment.
 * @param {{ text: string }} props
 */
export default function ExplanationCard({ text }) {
  const headingId = useId();
  return (
    <article aria-labelledby={headingId} className="rounded-lg border border-line bg-cream p-4">
      <h3 id={headingId} className="font-semibold text-maroon">
        Why this allocation
      </h3>
      <p className="mt-2 text-ink">{text}</p>
      <p className="mt-2 text-xs text-muted">
        Summary generated from the scoring formula; the ranking comes from the formula.
      </p>
    </article>
  );
}
