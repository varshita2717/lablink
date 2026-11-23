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
    return (
      <p className="mt-4 inline-flex rounded-full bg-cream px-3 py-1 text-sm font-semibold text-maroon">
        Confirmed.
      </p>
    );
  if (status === 'cancelled') return <p className="mt-3 text-muted">Cancelled.</p>;
  const submitting = status === 'submitting';
  return (
    <div className="mt-4 border-t border-line pt-4">
      {error && (
        <p role="alert" className="mb-2 text-sm text-red-800">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onConfirm} disabled={submitting} className="btn-success">
          {submitting ? 'Submitting…' : `${confirmLabel} ${subject}`}
        </button>
        <button type="button" onClick={onCancel} disabled={submitting} className="btn-secondary">
          Cancel {subject}
        </button>
      </div>
    </div>
  );
}
