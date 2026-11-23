// Test-only helpers: render components with a fake auth context and a memory router.
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';
import { AuthContext } from './context/AuthContext.jsx';

/**
 * Builds a fake auth context value.
 * @param {object} [overrides]
 * @returns {object}
 */
export function fakeAuth(overrides = {}) {
  return {
    user: { uid: 'u1', name: 'Asha', role: 'student', department: '' },
    demoMode: false,
    loading: false,
    error: null,
    signInWithGoogle: vi.fn(),
    signInAsGuest: vi.fn(),
    signOut: vi.fn(),
    setRole: vi.fn(),
    ...overrides,
  };
}

/**
 * Renders routes inside a MemoryRouter with the given auth value.
 * @param {import('react').ReactNode} routes `<Route>` elements.
 * @param {{ auth?: object, path?: string }} [options]
 */
export function renderRoutes(routes, { auth = fakeAuth(), path = '/' } = {}) {
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>{routes}</Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

export { Route };
