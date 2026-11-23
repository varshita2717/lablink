/**
 * Placeholder cards shown while a grid loads. Hidden from assistive tech; pair it with a Spinner
 * (role="status") so the loading state is announced.
 * @param {{ count?: number }} props
 */
export default function SkeletonGrid({ count = 6 }) {
  return (
    <ul aria-hidden="true" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="card p-5">
          <div className="h-10 w-10 rounded-lg bg-slate-200 motion-safe:animate-pulse" />
          <div className="mt-4 h-4 w-2/3 rounded bg-slate-200 motion-safe:animate-pulse" />
          <div className="mt-2 h-3 w-1/2 rounded bg-slate-100 motion-safe:animate-pulse" />
          <div className="mt-4 h-12 rounded bg-slate-100 motion-safe:animate-pulse" />
        </li>
      ))}
    </ul>
  );
}
