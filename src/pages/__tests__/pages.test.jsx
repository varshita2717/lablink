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
    expect(screen.getByRole('heading', { name: 'Smart slots' })).toBeInTheDocument();
    expect(screen.getByText('Intelligent slot booking')).toBeInTheDocument();
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

  it('shows "Go to app" instead of the sign-in buttons to signed-in users', () => {
    renderRoutes(<Route path="/welcome" element={<Welcome />} />, { path: '/welcome' });
    expect(screen.getByRole('link', { name: 'Go to app' })).toHaveAttribute('href', '/');
    expect(screen.queryByRole('button', { name: 'Explore as guest' })).not.toBeInTheDocument();
  });

  it('sends signed-in users back to the protected page they came from', () => {
    renderRoutes(
      <>
        <Route path="/welcome" element={<Welcome />} />
        <Route path="/catalogue" element={<p>Catalogue page</p>} />
      </>,
      { path: { pathname: '/welcome', state: { from: '/catalogue' } } },
    );
    expect(screen.getByText('Catalogue page')).toBeInTheDocument();
  });
});

describe('Welcome opening', () => {
  it('"Step inside" targets #enter, moves focus there, and the page has no axe violations', async () => {
    const user = userEvent.setup();
    const { container } = renderRoutes(<Route path="/" element={<Welcome />} />, {
      auth: signedOut(),
    });
    expect(screen.getByRole('heading', { level: 1, name: 'LabLink' })).toBeInTheDocument();
    const stepInside = screen.getByRole('link', { name: /Step inside/ });
    expect(stepInside).toHaveAttribute('href', '#enter');
    await user.click(stepInside);
    const entry = container.querySelector('#enter');
    expect(entry).toHaveFocus();
    expect(entry).toHaveAttribute('tabindex', '-1');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('keeps the sign-in buttons in the tab order', async () => {
    const user = userEvent.setup();
    renderRoutes(<Route path="/" element={<Welcome />} />, { auth: signedOut() });
    await user.tab(); // Step inside
    await user.tab();
    expect(screen.getByRole('button', { name: 'Explore as guest' })).toHaveFocus();
  });

  it('renders static sections without transforms under reduced motion', () => {
    const original = window.matchMedia;
    window.matchMedia = vi.fn(() => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    const { container } = renderRoutes(<Route path="/" element={<Welcome />} />, {
      auth: signedOut(),
    });
    expect(screen.getByRole('heading', { level: 1 })).not.toHaveAttribute('style');
    expect(container.querySelector('#enter')).not.toHaveAttribute('style');
    expect(screen.getByRole('region', { name: 'Welcome' })).not.toHaveClass('sticky');
    window.matchMedia = original;
  });
});
