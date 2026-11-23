import { friendlyError } from '../lib/format.js';

/**
 * Announced error with friendly text and an optional retry button.
 * @param {{ error: unknown, onRetry?: () => void, id?: string }} props
 */
export default function ErrorMessage({ error, onRetry, id }) {
  return (
    <div
      id={id}
      role="alert"
      className="flex flex-wrap items-center gap-3 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-red-900"
    >
      <p>{friendlyError(error)}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn-danger">
          Try again
        </button>
      )}
    </div>
  );
}
