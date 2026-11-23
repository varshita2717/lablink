import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import useAuth from '../hooks/useAuth.js';
import useDocumentTitle from '../hooks/useDocumentTitle.js';
import { APP_NAME, APP_TAGLINE } from '../lib/config.js';
import ErrorMessage from '../components/ErrorMessage.jsx';
import Icon from '../components/Icon.jsx';
import Spinner from '../components/Spinner.jsx';

// Short version of the README problem-alignment table (SPEC Section 2.6).
const CAPABILITIES = [
  {
    icon: 'search',
    title: 'Discover',
    need: 'Specialised equipment across departments',
    feature:
      'A GenAI assistant and a filterable catalogue of equipment, dev kits and workstations from four departments, grounded on the real inventory.',
  },
  {
    icon: 'calendar',
    title: 'Smart slots',
    need: 'Intelligent slot booking',
    feature:
      'Say "3 hours, 2 sessions a week" and the planner finds times when every item is free together, offering equivalent substitutes when one is taken.',
  },
  {
    icon: 'shield',
    title: 'Approvals',
    need: 'Project-based access and faculty approvals',
    feature:
      'Open equipment books instantly; restricted and hazardous equipment goes to the faculty guide as a project request with safety notes.',
  },
  {
    icon: 'scale',
    title: 'Fair conflicts',
    need: 'Fair allocation and better utilisation',
    feature:
      'Clashes are ranked by deadline, recent usage and project stage with an explainable formula, and quiet or busy equipment is flagged.',
  },
];

/** Public landing page: pitch, problem alignment, Google and guest sign-in. */
export default function Welcome() {
  useDocumentTitle('Welcome');
  const { user, loading, signInWithGoogle, signInAsGuest } = useAuth();
  const location = useLocation();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);

  if (user) return <Navigate to={location.state?.from ?? '/'} replace />;

  const run = (signIn) => async () => {
    setPending(true);
    setError(null);
    try {
      await signIn();
    } catch (err) {
      console.error('Sign-in failed', err);
      setError(err);
      setPending(false);
    }
  };

  return (
    <div className="space-y-12">
      <section className="card overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-teal-50 px-6 py-12 sm:px-10">
        <p className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-sm font-semibold text-teal-800 shadow-sm">
          <Icon name="flask" className="h-4 w-4" /> Campus lab sharing
        </p>
        <h1 className="mt-4 max-w-3xl text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          {APP_NAME}: book the right lab equipment in one conversation
        </h1>
        <p className="mt-3 text-lg font-medium text-indigo-800">{APP_TAGLINE}</p>
        <p className="mt-4 max-w-2xl text-slate-700">
          Tell the assistant what you want to build. It finds the equipment, plans the slots and
          prepares the booking, and humans stay in control. Hazardous work always goes through
          faculty, and conflicts are resolved by a fair, explainable formula.
        </p>
        <div aria-busy={loading || pending} className="mt-8">
          <h2 className="sr-only">Get started</h2>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={run(signInAsGuest)}
              disabled={loading || pending}
              className="btn-primary px-6 py-3 text-base"
            >
              Explore as guest
            </button>
            <button
              type="button"
              onClick={run(signInWithGoogle)}
              disabled={loading || pending}
              className="btn-secondary px-6 py-3 text-base"
            >
              Sign in with Google
            </button>
          </div>
          {(loading || pending) && <Spinner label="Signing in" />}
          {error && (
            <div className="mt-4">
              <ErrorMessage error={error} />
            </div>
          )}
        </div>
      </section>

      <section aria-labelledby="problem-heading">
        <h2 id="problem-heading" className="text-2xl font-bold tracking-tight">
          How LabLink solves the problem
        </h2>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CAPABILITIES.map((item) => (
            <li key={item.title} className="card card-hover p-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                <Icon name={item.icon} className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-semibold text-slate-900">{item.title}</h3>
              <p className="mt-1 text-sm font-medium text-indigo-700">{item.need}</p>
              <p className="mt-2 text-sm text-slate-600">{item.feature}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
