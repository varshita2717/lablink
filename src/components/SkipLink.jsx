/** First focusable element on every page; jumps keyboard users past the header. */
export default function SkipLink() {
  return (
    <a
      href="#main"
      className="sr-only rounded-md bg-blue-800 px-4 py-2 font-semibold text-white focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50"
    >
      Skip to main content
    </a>
  );
}
