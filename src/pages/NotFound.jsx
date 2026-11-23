import { Link } from 'react-router-dom';
import useDocumentTitle from '../hooks/useDocumentTitle.js';

/** Shown for any unknown route. */
export default function NotFound() {
  useDocumentTitle('Page not found');
  return (
    <section aria-labelledby="not-found-heading" className="mx-auto max-w-xl text-center">
      <h1 id="not-found-heading" className="text-2xl font-bold">
        Page not found
      </h1>
      <p className="mt-3 text-muted">The page you asked for does not exist.</p>
      <Link to="/" className="btn-primary mt-6">
        Go to the home page
      </Link>
    </section>
  );
}
