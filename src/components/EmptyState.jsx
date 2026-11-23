/**
 * Empty list message with a suggested next step.
 * @param {{ title: string, children?: import('react').ReactNode }} props
 */
export default function EmptyState({ title, children }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
      <p className="font-semibold text-slate-900">{title}</p>
      {children && <div className="mt-2 text-slate-700">{children}</div>}
    </div>
  );
}
