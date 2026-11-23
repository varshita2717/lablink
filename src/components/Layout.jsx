import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { APP_NAME, APP_TAGLINE } from '../lib/config.js';
import Logo from './Logo.jsx';
import Navbar from './Navbar.jsx';
import SkipLink from './SkipLink.jsx';
import Spinner from './Spinner.jsx';

/** Page frame with landmarks: skip link, sticky header with navbar, main (#main) and footer. */
export default function Layout() {
  return (
    <div className="flex min-h-screen flex-col">
      <SkipLink />
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Logo />
          <Navbar />
        </div>
      </header>
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:py-10">
        <Suspense fallback={<Spinner label="Loading page" />}>
          <Outlet />
        </Suspense>
      </main>
      <footer className="border-t border-slate-200 bg-white">
        <p className="mx-auto max-w-6xl px-4 py-5 text-sm text-slate-600">
          {APP_NAME}: {APP_TAGLINE}
        </p>
      </footer>
    </div>
  );
}
