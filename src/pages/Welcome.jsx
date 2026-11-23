import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import useAuth from '../hooks/useAuth.js';
import useDocumentTitle from '../hooks/useDocumentTitle.js';
import { APP_NAME, APP_TAGLINE } from '../lib/config.js';
import ErrorMessage from '../components/ErrorMessage.jsx';
import Spinner from '../components/Spinner.jsx';

// Short version of the README problem-alignment table (SPEC Section 2.6).
const CAPABILITIES = [
  {
    need: 'Discover specialised equipment across departments',
    feature:
      'A GenAI assistant and a filterable catalogue of equipment, dev kits and workstations from four departments, grounded on the real inventory.',
  },
  {
    need: 'Intelligent slot booking',
    feature:
      'Say "3 hours, 2 sessions a week" and the planner finds times when every item is free together, offering equivalent substitutes when one is taken.',
  },
  {
    need: 'Project-based access and faculty approvals',
    feature:
      'Open equipment books instantly; restricted and hazardous equipment goes to the faculty guide as a project request with safety notes.',
  },
  {
    need: 'Fair allocation and better utilisation',
    feature:
      'Clashes are ranked by deadline, recent usage and project stage with an explainable formula, and quiet or busy equipment is flagged.',
  },
];

const buttonBase =
  'rounded-md px-5 py-2.5 font-semibold disabled:cursor-not-allowed disabled:opacity-60';

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
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{APP_NAME}</h1>
      <p className="mt-2 text-lg font-medium text-blue-900">{APP_TAGLINE}</p>
      <p className="mt-4 text-slate-700">
        Tell the assistant what you want to build. It finds the equipment, plans the slots and
        prepares the booking, and humans stay in control. Hazardous work always goes through
        faculty, and conflicts are resolved by a fair, explainable formula.
      </p>

      <section aria-labelledby="sign-in-heading" className="mt-8" aria-busy={loading || pending}>
        <h2 id="sign-in-heading" className="text-xl font-semibold">
          Get started
        </h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={run(signInWithGoogle)}
            disabled={loading || pending}
            className={`${buttonBase} bg-blue-800 text-white hover:bg-blue-900`}
          >
            Sign in with Google
          </button>
          <button
            type="button"
            onClick={run(signInAsGuest)}
            disabled={loading || pending}
            className={`${buttonBase} border border-blue-800 bg-white text-blue-900 hover:bg-blue-50`}
          >
            Explore as guest
          </button>
        </div>
        {(loading || pending) && <Spinner label="Signing in" />}
        {error && (
          <div className="mt-4">
            <ErrorMessage error={error} />
          </div>
        )}
      </section>

      <section aria-labelledby="problem-heading" className="mt-10">
        <h2 id="problem-heading" className="text-xl font-semibold">
          How LabLink solves the problem
        </h2>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2">
          {CAPABILITIES.map((item) => (
            <li key={item.need} className="rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="font-semibold text-slate-900">{item.need}</h3>
              <p className="mt-1 text-slate-700">{item.feature}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
