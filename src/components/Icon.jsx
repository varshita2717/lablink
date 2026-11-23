// Decorative inline SVG icons (24px grid, stroke style). Always aria-hidden: the text beside an
// icon carries the meaning.
const PATHS = {
  flask: 'M9 3h6M10 3v6.5L4.6 18.4A1.7 1.7 0 0 0 6 21h12a1.7 1.7 0 0 0 1.4-2.6L14 9.5V3M7.5 15h9',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-4.3-4.3',
  calendar:
    'M7 3v3M17 3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM8 12h3v3H8z',
  shield: 'M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6l7-3zM9 12l2 2 4-4',
  scale:
    'M12 4v16M7 20h10M5 8h14M5 8l-2.5 6a3 3 0 0 0 5 0L5 8zM19 8l-2.5 6a3 3 0 0 0 5 0L19 8zM12 4l-7 4M12 4l7 4',
  gauge: 'M4 15a8 8 0 1 1 16 0M12 15l4-5M8 19h8',
  chip: 'M8 8h8v8H8zM9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3M5 5h14v14H5z',
  monitor: 'M3 5h18v11H3zM8 20h8M12 16v4',
  wrench:
    'M14.7 6.3a4 4 0 0 0 5 5l-8.4 8.4a2 2 0 0 1-2.9-2.9l8.4-8.4a4 4 0 0 0-5-5l2.4 2.4-1.5 1.5z',
  flame: 'M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-3-1-5 1-8.5z',
  cpu: 'M7 7h10v10H7zM10 10h4v4h-4zM9 3v4M15 3v4M9 17v4M15 17v4M3 9h4M3 15h4M17 9h4M17 15h4',
  inbox: 'M3 13l3-8h12l3 8M3 13v6h18v-6M3 13h5l1 2h6l1-2h5',
  chat: 'M4 5h16v11H9l-5 4V5z',
  arrow: 'M5 12h14M13 6l6 6-6 6',
};

/**
 * Decorative icon.
 * @param {{ name: keyof typeof PATHS, className?: string }} props
 */
export default function Icon({ name, className = 'h-5 w-5' }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d={PATHS[name] ?? PATHS.flask} />
    </svg>
  );
}

/** Icon per equipment category. */
export const CATEGORY_ICONS = {
  Measurement: 'gauge',
  'Dev Kit': 'chip',
  Workstation: 'monitor',
  Fabrication: 'wrench',
  Computing: 'cpu',
  Glassware: 'flask',
  Heating: 'flame',
};
