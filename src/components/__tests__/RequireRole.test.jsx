import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import RequireRole from '../RequireRole.jsx';
import { Route, fakeAuth, renderRoutes } from '../../testUtils.jsx';

vi.mock('../../lib/firebase.js', () => ({ db: {}, auth: {} }));

const routes = (
  <>
    <Route path="/welcome" element={<p>Welcome page</p>} />
    <Route path="/" element={<p>Home page</p>} />
    <Route
      path="/admin"
      element={
        <RequireRole roles={['admin']}>
          <p>Admin page</p>
        </RequireRole>
      }
    />
  </>
);

describe('RequireRole', () => {
  it('sends signed-out users to /welcome', () => {
    renderRoutes(routes, { auth: fakeAuth({ user: null }), path: '/admin' });
    expect(screen.getByText('Welcome page')).toBeInTheDocument();
  });

  it('sends users without the role to /', () => {
    renderRoutes(routes, { path: '/admin' });
    expect(screen.getByText('Home page')).toBeInTheDocument();
  });

  it('renders the page for an allowed role', () => {
    const auth = fakeAuth();
    auth.user.role = 'admin';
    renderRoutes(routes, { auth, path: '/admin' });
    expect(screen.getByText('Admin page')).toBeInTheDocument();
  });

  it('shows a spinner while sign-in is being checked', () => {
    renderRoutes(routes, { auth: fakeAuth({ user: null, loading: true }), path: '/admin' });
    expect(screen.getByRole('status')).toHaveTextContent('Checking sign-in');
  });
});
