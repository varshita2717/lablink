import Icon from './Icon.jsx';

/**
 * Empty list message with an icon and a suggested next step (pass a link or button as children).
 * @param {{ title: string, icon?: string, children?: import('react').ReactNode }} props
 */
export default function EmptyState({ title, icon = 'inbox', children }) {
  return (
    <div className="card flex flex-col items-center border-dashed px-6 py-10 text-center shadow-none">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
        <Icon name={icon} className="h-6 w-6" />
      </span>
      <p className="mt-3 font-semibold text-slate-900">{title}</p>
      {children && <div className="mt-3 text-slate-600">{children}</div>}
    </div>
  );
}
