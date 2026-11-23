import { useRef, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import useAuth from '../hooks/useAuth.js';
import useDocumentTitle from '../hooks/useDocumentTitle.js';
import usePrefersReducedMotion from '../hooks/usePrefersReducedMotion.js';
import useScrollProgress from '../hooks/useScrollProgress.js';
import WelcomeEntry from '../components/WelcomeEntry.jsx';
import WelcomeHero from '../components/WelcomeHero.jsx';

const clamp01 = (value) => Math.min(1, Math.max(0, value));

/** Public landing page: zoom-through opening, then the entry section with sign-in and features. */
export default function Welcome() {
  useDocumentTitle('Welcome');
  const { user, loading, signInWithGoogle, signInAsGuest } = useAuth();
  const location = useLocation();
  const reduced = usePrefersReducedMotion();
  const openingRef = useRef(null);
  const entryRef = useRef(null);
  const progress = useScrollProgress(openingRef, !reduced);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);

  // Signed-in users sent here from a protected page go straight back to it.
  if (user && location.state?.from) return <Navigate to={location.state.from} replace />;

  const run = (signIn) => async () => {
    setPending(true);
    setError(null);
    try {
      await signIn();
    } catch (err) {
      console.error('Sign-in failed', err);
      setError(err);
    } finally {
      setPending(false);
    }
  };

  const stepInside = (event) => {
    event.preventDefault();
    const entry = entryRef.current;
    entry?.scrollIntoView?.({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    entry?.focus({ preventScroll: true });
  };

  const reveal = clamp01((progress - 0.6) / 0.35);
  const entryStyle = reduced
    ? undefined
    : { opacity: reveal, transform: `translateY(${24 * (1 - reveal)}px)` };

  return (
    <div className="-mt-8 sm:-mt-10">
      <div ref={openingRef} className={reduced ? '' : 'h-[220vh]'}>
        <WelcomeHero progress={progress} reduced={reduced} onStepInside={stepInside} />
      </div>
      <WelcomeEntry
        ref={entryRef}
        signedIn={Boolean(user)}
        busy={loading || pending}
        error={error}
        onGuest={run(signInAsGuest)}
        onGoogle={run(signInWithGoogle)}
        style={reduced ? undefined : { ...entryStyle, marginTop: '-60vh' }}
      />
    </div>
  );
}
