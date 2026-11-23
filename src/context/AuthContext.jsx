import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInAnonymously,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { auth } from '../lib/firebase.js';
import { ensureUserDoc, loadDemoMode, setDemoRole } from '../lib/users.js';
import { GUEST_DISPLAY_NAME } from '../lib/config.js';

/** @type {import('react').Context<object | null>} */
export const AuthContext = createContext(null);

/**
 * Provides the signed-in user (`{ uid, name, role, department }` or null), the demo flag
 * and the sign-in, sign-out and demo role-switch actions.
 */
export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [demoMode, setDemoMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    return onAuthStateChanged(auth, async (authUser) => {
      setLoading(true);
      setError(null);
      try {
        if (!authUser) {
          setUser(null);
          setDemoMode(false);
          return;
        }
        const fallback = authUser.isAnonymous ? GUEST_DISPLAY_NAME : 'Student';
        const [profile, demo] = await Promise.all([
          ensureUserDoc(authUser, fallback),
          loadDemoMode(),
        ]);
        setUser(profile);
        setDemoMode(demo);
      } catch (err) {
        console.error('Could not load the user profile', err);
        setError(err);
        setUser(null);
      } finally {
        setLoading(false);
      }
    });
  }, []);

  const signInWithGoogle = useCallback(() => signInWithPopup(auth, new GoogleAuthProvider()), []);
  const signInAsGuest = useCallback(() => signInAnonymously(auth), []);
  const signOut = useCallback(() => firebaseSignOut(auth), []);

  const setRole = useCallback(
    async (role) => {
      if (!user) return;
      await setDemoRole(user.uid, role);
      setUser((current) => (current ? { ...current, role } : current));
    },
    [user],
  );

  const value = useMemo(
    () => ({ user, demoMode, loading, error, signInWithGoogle, signInAsGuest, signOut, setRole }),
    [user, demoMode, loading, error, signInWithGoogle, signInAsGuest, signOut, setRole],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
