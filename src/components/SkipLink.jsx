/** First focusable element on every page; jumps keyboard users past the header. */
export default function SkipLink() {
  return (
    <a
      href="#main"
      className="sr-only rounded-lg bg-maroon px-4 py-2 font-semibold text-white shadow-md focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50"
    >
      Skip to main content
    </a>
  );
}
