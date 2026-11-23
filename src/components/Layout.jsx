import { Suspense } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { APP_NAME, APP_TAGLINE } from '../lib/config.js';
import Navbar from './Navbar.jsx';
import SkipLink from './SkipLink.jsx';
import Spinner from './Spinner.jsx';

/** Page frame with landmarks: skip link, header with navbar, main (#main) and footer. */
export default function Layout() {
  return (
    <div className="flex min-h-screen flex-col">
      <SkipLink />
      <header className="bg-blue-900 text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-3">
          <Link to="/" className="rounded text-xl font-bold tracking-tight">
            {APP_NAME}
          </Link>
          <Navbar />
        </div>
      </header>
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Suspense fallback={<Spinner label="Loading page" />}>
          <Outlet />
        </Suspense>
      </main>
      <footer className="border-t border-slate-200 bg-white">
        <p className="mx-auto max-w-6xl px-4 py-4 text-sm text-slate-700">
          {APP_NAME}: {APP_TAGLINE}
        </p>
      </footer>
    </div>
  );
}
