/**
 * Accessible loading indicator: announced politely via role="status".
 * @param {{ label?: string }} props
 */
export default function Spinner({ label = 'Loading' }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-6">
      <span
        aria-hidden="true"
        className="h-6 w-6 rounded-full border-4 border-slate-300 border-t-indigo-700 motion-safe:animate-spin"
      />
      <span className="sr-only">{label}</span>
    </div>
  );
}
