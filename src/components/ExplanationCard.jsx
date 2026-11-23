import { useId } from 'react';

export const AI_LABEL = 'AI-generated summary; the ranking comes from the formula';
export const TEMPLATE_LABEL =
  'Summary generated from the scoring formula; the ranking comes from the formula';

/**
 * "Why this allocation" card. Shows the template text at once, then the AI summary when it arrives.
 * @param {{ text: string, source?: 'ai' | 'template', pending?: boolean, retrying?: boolean }} props
 */
export default function ExplanationCard({
  text,
  source = 'template',
  pending = false,
  retrying = false,
}) {
  const headingId = useId();
  let status = '';
  if (pending) status = retrying ? 'The assistant is busy, retrying…' : 'Writing an AI summary…';
  return (
    <article
      aria-labelledby={headingId}
      aria-busy={pending}
      className="rounded-lg border border-line bg-cream p-4"
    >
      <h3 id={headingId} className="font-semibold text-maroon">
        Why this allocation
      </h3>
      <p aria-live="polite" className="mt-2 text-ink">
        {text}
      </p>
      <p className="mt-2 text-xs text-muted">{source === 'ai' ? AI_LABEL : TEMPLATE_LABEL}</p>
      <p role="status" className="mt-1 text-xs text-muted">
        {status}
      </p>
    </article>
  );
}
