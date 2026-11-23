import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import useAuth from '../hooks/useAuth.js';
import { ROLES, ROLE_LABELS } from '../lib/config.js';
import { friendlyError } from '../lib/format.js';

// Links appear here as their pages are built. `roles` hides links a role cannot use.
const LINKS = [
  { to: '/', label: 'Chat', end: true },
  { to: '/catalogue', label: 'Catalogue' },
  { to: '/my-bookings', label: 'My Bookings' },
  { to: '/my-requests', label: 'My Requests', roles: ['student'] },
  { to: '/approvals', label: 'Approvals', roles: ['faculty', 'admin'] },
  { to: '/conflicts', label: 'Conflicts', roles: ['faculty', 'admin'] },
  { to: '/admin', label: 'Admin', roles: ['admin'] },
];

const linkClass = ({ isActive }) =>
  `inline-flex min-h-10 items-center border-b-2 px-1 text-sm font-medium motion-safe:transition-colors ${
    isActive
      ? 'border-maroon text-maroon'
      : 'border-transparent text-muted hover:border-line hover:text-ink'
  }`;

/** Main navigation: links by role, demo role switcher (demo mode only), user name and sign out. */
export default function Navbar() {
  const { user, demoMode, setRole, signOut } = useAuth();
  const [switching, setSwitching] = useState(false);
  const [roleError, setRoleError] = useState(null);
  if (!user) return null;

  const handleRoleChange = async (event) => {
    setSwitching(true);
    setRoleError(null);
    try {
      await setRole(event.target.value);
    } catch (error) {
      console.error('Role switch failed', error);
      setRoleError(error);
    } finally {
      setSwitching(false);
    }
  };

  return (
    <nav aria-label="Main" className="flex flex-1 flex-wrap items-center gap-x-3 gap-y-2">
      <ul className="flex flex-wrap items-center gap-x-4">
        {LINKS.filter((link) => !link.roles || link.roles.includes(user.role)).map((link) => (
          <li key={link.to}>
            <NavLink to={link.to} end={link.end} className={linkClass}>
              {link.label}
            </NavLink>
          </li>
        ))}
      </ul>
      <div className="ml-auto flex flex-wrap items-center gap-3">
        {demoMode && (
          <div className="flex items-center gap-2">
            <label htmlFor="demo-role" className="text-sm font-medium text-muted">
              Role (demo)
            </label>
            <select
              id="demo-role"
              value={user.role}
              onChange={handleRoleChange}
              disabled={switching}
              aria-describedby={roleError ? 'role-error' : undefined}
              className="rounded-full border border-line bg-cream px-3 py-1.5 text-sm font-semibold text-maroon"
            >
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </select>
            {roleError && (
              <span id="role-error" role="alert" className="text-sm text-red-800">
                {friendlyError(roleError)}
              </span>
            )}
          </div>
        )}
        <span className="text-sm text-muted">
          {user.name} <span className="text-muted">({ROLE_LABELS[user.role]})</span>
        </span>
        <button type="button" onClick={signOut} className="btn-secondary min-h-9 px-3 py-1.5">
          Sign out
        </button>
      </div>
    </nav>
  );
}
