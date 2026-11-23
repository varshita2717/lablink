import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import useAuth from '../hooks/useAuth.js';
import { approveRequest, rejectRequest } from '../lib/requests.js';
import { MAX_COMMENT } from '../lib/config.js';
import { today } from '../lib/dates.js';
import ErrorMessage from './ErrorMessage.jsx';
import RequestDetails from './RequestDetails.jsx';

/**
 * One pending request in the approval queue: Approve (locked when in conflict) or Reject with a
 * required comment.
 * @param {{ request: object, inConflict: boolean, onDecided: (message: string) => void }} props
 */
export default function ApprovalItem({ request, inConflict, onDecided }) {
  const { user } = useAuth();
  const id = useId();
  const [comment, setComment] = useState('');
  const [commentError, setCommentError] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const label = `${request.studentName}, ${request.projectTitle}`;

  const run = async (action) => {
    setPending(true);
    setError(null);
    try {
      onDecided(await action());
    } catch (err) {
      console.error('Decision failed', err);
      setError(err);
      setPending(false);
    }
  };

  const handleApprove = () =>
    run(async () => {
      const result = await approveRequest(request, user, today());
      return result.status === 'approved'
        ? `Approved and booked: ${label}.`
        : `Could not book ${label}: the slots were taken. It is marked "not allocated" with alternatives for the student.`;
    });

  const handleReject = () => {
    const text = comment.trim();
    if (!text) {
      setCommentError('A comment is required to reject a request.');
      return;
    }
    setCommentError('');
    run(async () => {
      await rejectRequest(request.id, user, text);
      return `Rejected: ${label}.`;
    });
  };

  return (
    <article aria-labelledby={`${id}-title`} className="card p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id={`${id}-title`} className="text-lg font-semibold">
          {request.projectTitle}
        </h2>
        <span className="text-muted">by {request.studentName}</span>
        {request.facultyUid === user.uid && (
          <span className="rounded-full border border-line bg-cream px-2 py-0.5 text-xs font-semibold text-maroon">
            Your student
          </span>
        )}
      </div>
      <div className="mt-3">
        <RequestDetails request={request} />
      </div>
      {inConflict && (
        <p className="mt-3 rounded-lg border border-orange-300 bg-orange-50 px-3 py-2 text-orange-950">
          In conflict:{' '}
          <Link to="/conflicts" className="font-semibold underline">
            resolve on the Conflicts page
          </Link>
        </p>
      )}
      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <div>
          <label htmlFor={`${id}-comment`} className="text-sm font-medium">
            Comment (required to reject, up to {MAX_COMMENT} characters)
          </label>
          <textarea
            id={`${id}-comment`}
            value={comment}
            maxLength={MAX_COMMENT}
            rows={2}
            onChange={(event) => setComment(event.target.value)}
            aria-invalid={Boolean(commentError)}
            aria-describedby={commentError ? `${id}-comment-error` : undefined}
            className="field"
          />
          {commentError && (
            <p id={`${id}-comment-error`} role="alert" className="text-sm text-red-800">
              {commentError}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleApprove}
            disabled={pending || inConflict}
            className="btn-success"
          >
            Approve {label}
          </button>
          <button type="button" onClick={handleReject} disabled={pending} className="btn-danger">
            Reject {label}
          </button>
        </div>
      </div>
      {error && (
        <div className="mt-3">
          <ErrorMessage error={error} />
        </div>
      )}
    </article>
  );
}
