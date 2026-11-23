import { Navigate, useLocation } from 'react-router-dom';
import useAuth from '../hooks/useAuth.js';
import Spinner from './Spinner.jsx';

/**
 * Guards a route: signed-out users go to /welcome; users without an allowed role go to /
 * with an explanatory message (read from router state by the home page).
 * @param {{ roles?: string[], children: import('react').ReactNode }} props
 */
export default function RequireRole({ roles, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner label="Checking sign-in" />;
  if (!user) return <Navigate to="/welcome" replace state={{ from: location.pathname }} />;
  if (roles && !roles.includes(user.role)) {
    return (
      <Navigate
        to="/"
        replace
        state={{ notice: 'That page is not available for your role, so you were sent here.' }}
      />
    );
  }
  return children;
}
