/**
 * Confirm and Cancel buttons for a chat card, with specific accessible names. Disabled while
 * submitting (prevents double-submit); replaced by a status line once the card is decided.
 * @param {{ status: string, error?: string | null, subject: string, confirmLabel?: string,
 *           onConfirm: () => void, onCancel: () => void }} props
 */
export default function CardActions({
  status,
  error,
  subject,
  confirmLabel = 'Confirm',
  onConfirm,
  onCancel,
}) {
  if (status === 'confirmed')
    return <p className="mt-3 font-semibold text-green-900">Confirmed.</p>;
  if (status === 'cancelled') return <p className="mt-3 text-slate-700">Cancelled.</p>;
  const submitting = status === 'submitting';
  return (
    <div className="mt-3">
      {error && (
        <p role="alert" className="mb-2 text-sm text-red-800">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onConfirm}
          disabled={submitting}
          className="rounded-md bg-green-800 px-4 py-2 font-semibold text-white hover:bg-green-900 disabled:opacity-60"
        >
          {submitting ? 'Submitting…' : `${confirmLabel} ${subject}`}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="rounded-md border border-slate-500 px-4 py-2 font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
        >
          Cancel {subject}
        </button>
      </div>
    </div>
  );
}
