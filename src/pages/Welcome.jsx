import useDocumentTitle from '../hooks/useDocumentTitle.js';
import { APP_NAME, APP_TAGLINE } from '../lib/config.js';

/** Public landing page. Sign-in and the problem-alignment summary arrive in segment F2. */
export default function Welcome() {
  useDocumentTitle('Welcome');
  return (
    <section aria-labelledby="welcome-heading" className="mx-auto max-w-3xl">
      <h1 id="welcome-heading" className="text-3xl font-bold tracking-tight sm:text-4xl">
        {APP_NAME}
      </h1>
      <p className="mt-2 text-lg font-medium text-blue-900">{APP_TAGLINE}</p>
      <p className="mt-6 text-slate-700">
        Tell the assistant what you want to build. It finds the lab equipment, plans the slots and
        prepares the booking, and humans stay in control.
      </p>
    </section>
  );
}
