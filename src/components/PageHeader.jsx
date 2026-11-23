/**
 * Consistent page header: the page's single h1, a short description and optional actions.
 * @param {{ title: string, description?: string, children?: import('react').ReactNode }} props
 */
export default function PageHeader({ title, description, children }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-muted">{description}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}
