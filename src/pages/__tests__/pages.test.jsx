import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import Welcome from '../Welcome.jsx';
import NotFound from '../NotFound.jsx';
import { Route, fakeAuth, renderRoutes } from '../../testUtils.jsx';

vi.mock('../../lib/firebase.js', () => ({ db: {}, auth: {} }));

const signedOut = () => fakeAuth({ user: null });

describe.each([
  ['Welcome', Welcome, 'Welcome · LabLink'],
  ['NotFound', NotFound, 'Page not found · LabLink'],
])('%s page', (_name, Page, expectedTitle) => {
  it('has one h1, a unique title and no axe violations', async () => {
    const { container } = renderRoutes(<Route path="/" element={<Page />} />, {
      auth: signedOut(),
    });
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(document.title).toBe(expectedTitle);
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('Welcome sign-in', () => {
  it('shows the problem-alignment summary', () => {
    renderRoutes(<Route path="/" element={<Welcome />} />, { auth: signedOut() });
    expect(
      screen.getByRole('heading', { name: 'How LabLink solves the problem' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Intelligent slot booking' })).toBeInTheDocument();
  });

  it('signs in as a guest', async () => {
    const user = userEvent.setup();
    const auth = signedOut();
    renderRoutes(<Route path="/" element={<Welcome />} />, { auth });
    await user.click(screen.getByRole('button', { name: 'Explore as guest' }));
    expect(auth.signInAsGuest).toHaveBeenCalled();
  });

  it('shows a friendly error when sign-in fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const user = userEvent.setup();
    const auth = fakeAuth({
      user: null,
      signInWithGoogle: vi.fn().mockRejectedValue(new Error('x')),
    });
    renderRoutes(<Route path="/" element={<Welcome />} />, { auth });
    await user.click(screen.getByRole('button', { name: 'Sign in with Google' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong');
    vi.restoreAllMocks();
  });

  it('redirects signed-in users to the home page', () => {
    renderRoutes(
      <>
        <Route path="/welcome" element={<Welcome />} />
        <Route path="/" element={<p>Home page</p>} />
      </>,
      { path: '/welcome' },
    );
    expect(screen.getByText('Home page')).toBeInTheDocument();
  });
});
