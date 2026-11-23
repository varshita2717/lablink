import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import Navbar from '../Navbar.jsx';
import { Route, fakeAuth, renderRoutes } from '../../testUtils.jsx';

vi.mock('../../lib/firebase.js', () => ({ db: {}, auth: {} }));

const renderNavbar = (auth) => renderRoutes(<Route path="/" element={<Navbar />} />, { auth });

describe('Navbar', () => {
  it('shows the user, sign out, and only the links the role can use', () => {
    renderNavbar();
    expect(screen.getByRole('link', { name: 'Catalogue' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Admin' })).not.toBeInTheDocument();
    expect(screen.getByText('Asha')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
  });

  it('shows the Admin link to admins', () => {
    const auth = fakeAuth();
    auth.user.role = 'admin';
    renderNavbar(auth);
    expect(screen.getByRole('link', { name: 'Admin' })).toBeInTheDocument();
  });

  it('hides the role switcher unless demo mode is on', () => {
    renderNavbar();
    expect(screen.queryByLabelText('Role (demo)')).not.toBeInTheDocument();
  });

  it('switches role through the labelled demo switcher', async () => {
    const user = userEvent.setup();
    const auth = fakeAuth({ demoMode: true });
    renderNavbar(auth);
    await user.selectOptions(screen.getByLabelText('Role (demo)'), 'faculty');
    expect(auth.setRole).toHaveBeenCalledWith('faculty');
  });

  it('announces a failed role switch', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const user = userEvent.setup();
    const auth = fakeAuth({
      demoMode: true,
      setRole: vi.fn().mockRejectedValue({ code: 'permission-denied' }),
    });
    renderNavbar(auth);
    await user.selectOptions(screen.getByLabelText('Role (demo)'), 'admin');
    expect(await screen.findByRole('alert')).toHaveTextContent('You do not have permission');
    vi.restoreAllMocks();
  });

  it('signs out', async () => {
    const user = userEvent.setup();
    const auth = fakeAuth();
    renderNavbar(auth);
    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(auth.signOut).toHaveBeenCalled();
  });

  it('has no axe violations (demo mode on)', async () => {
    const { container } = renderNavbar(fakeAuth({ demoMode: true }));
    expect(await axe(container)).toHaveNoViolations();
  });
});
