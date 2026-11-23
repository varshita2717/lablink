import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext.jsx';

/**
 * Reads the auth context.
 * @returns {object} `{ user, demoMode, loading, error, signInWithGoogle, signInAsGuest, signOut, setRole }`.
 * @throws {Error} If used outside AuthProvider.
 */
export default function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
