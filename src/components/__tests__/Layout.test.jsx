import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import Layout from '../Layout.jsx';
import { Route, fakeAuth, renderRoutes } from '../../testUtils.jsx';

vi.mock('../../lib/firebase.js', () => ({ db: {}, auth: {} }));

function renderLayout(auth) {
  return renderRoutes(
    <Route element={<Layout />}>
      <Route path="/" element={<h1>Page heading</h1>} />
    </Route>,
    { auth },
  );
}

describe('Layout', () => {
  it('renders the landmarks and the page content', () => {
    renderLayout();
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main');
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Page heading' })).toBeInTheDocument();
  });

  it('makes the skip link the first focusable element, targeting #main', async () => {
    const user = userEvent.setup();
    renderLayout();
    await user.tab();
    const skip = screen.getByRole('link', { name: 'Skip to main content' });
    expect(skip).toHaveFocus();
    expect(skip).toHaveAttribute('href', '#main');
  });

  it('hides the navbar when signed out', () => {
    renderLayout(fakeAuth({ user: null }));
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    const { container } = renderLayout();
    expect(await axe(container)).toHaveNoViolations();
  });
});
