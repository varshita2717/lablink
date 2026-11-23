import { forwardRef } from 'react';
import { Link } from 'react-router-dom';
import { APP_TAGLINE } from '../lib/config.js';
import ErrorMessage from './ErrorMessage.jsx';
import Icon from './Icon.jsx';
import Spinner from './Spinner.jsx';

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
    title: 'Faculty approvals',
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

/**
 * Entry section (#enter): sign-in card (or "Go to app" when signed in) and the feature cards.
 * @param {{ signedIn: boolean, busy: boolean, error: unknown, onGuest: () => void,
 *           onGoogle: () => void, style?: object }} props
 */
const WelcomeEntry = forwardRef(function WelcomeEntry(
  { signedIn, busy, error, onGuest, onGoogle, style },
  ref,
) {
  return (
    <section
      ref={ref}
      id="enter"
      tabIndex={-1}
      aria-labelledby="enter-heading"
      style={style}
      className="relative z-10 space-y-12 bg-cream pt-4 pb-8 focus-within:!opacity-100 focus-within:![transform:none]"
    >
      <div className="card mx-auto max-w-2xl p-8 text-center" aria-busy={busy}>
        <h2 id="enter-heading" className="text-2xl font-bold text-ink">
          Step inside LabLink
        </h2>
        <p className="mt-2 text-muted">
          {APP_TAGLINE} Tell the assistant what you want to build; it finds the equipment, plans the
          slots and prepares the booking.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {signedIn ? (
            <Link to="/" className="btn-primary px-6 py-3 text-base">
              Go to app
            </Link>
          ) : (
            <>
              <button
                type="button"
                onClick={onGuest}
                disabled={busy}
                className="btn-primary px-6 py-3 text-base"
              >
                Explore as guest
              </button>
              <button
                type="button"
                onClick={onGoogle}
                disabled={busy}
                className="btn-secondary px-6 py-3 text-base"
              >
                Sign in with Google
              </button>
            </>
          )}
        </div>
        {busy && <Spinner label="Signing in" />}
        {error && (
          <div className="mt-4 text-left">
            <ErrorMessage error={error} />
          </div>
        )}
      </div>

      <div>
        <h2 className="text-center text-2xl font-bold text-ink">How LabLink solves the problem</h2>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CAPABILITIES.map((item) => (
            <li key={item.title} className="card card-hover p-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-cream text-brick">
                <Icon name={item.icon} className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-semibold text-ink">{item.title}</h3>
              <p className="mt-1 text-sm font-medium text-maroon">{item.need}</p>
              <p className="mt-2 text-sm text-muted">{item.feature}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
});

export default WelcomeEntry;
