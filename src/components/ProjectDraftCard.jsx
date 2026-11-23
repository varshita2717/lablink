import { useId } from 'react';
import { STAGE_LABELS } from '../lib/config.js';
import { formatDate } from '../lib/format.js';
import CardActions from './CardActions.jsx';

/**
 * Draft project for the student to confirm (SPEC 13.4).
 * @param {{ card: { data: object, status: string, error?: string }, onConfirm: () => void,
 *           onCancel: () => void }} props
 */
export default function ProjectDraftCard({ card, onConfirm, onCancel }) {
  const id = useId();
  const { data } = card;
  return (
    <article aria-labelledby={id} className="card p-5">
      <h2 id={id} className="text-lg font-semibold text-slate-900">
        New project: {data.title}
      </h2>
      <dl className="mt-2 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[max-content_1fr]">
        <dt className="font-semibold">Description</dt>
        <dd className="whitespace-pre-wrap">{data.description || '—'}</dd>
        <dt className="font-semibold">Deadline</dt>
        <dd>{formatDate(data.deadline)}</dd>
        <dt className="font-semibold">Stage</dt>
        <dd>{STAGE_LABELS[data.stage]}</dd>
        <dt className="font-semibold">Faculty guide</dt>
        <dd>{data.facultyGuideName}</dd>
      </dl>
      <CardActions
        status={card.status}
        error={card.error}
        subject={`project ${data.title}`}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    </article>
  );
}
