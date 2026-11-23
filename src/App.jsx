import { lazy } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import AuthProvider from './context/AuthContext.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import Layout from './components/Layout.jsx';
import RequireRole from './components/RequireRole.jsx';

const Welcome = lazy(() => import('./pages/Welcome.jsx'));
const Catalogue = lazy(() => import('./pages/Catalogue.jsx'));
const Admin = lazy(() => import('./pages/Admin.jsx'));
const NotFound = lazy(() => import('./pages/NotFound.jsx'));

/** Root component: error boundary, auth, router and lazily loaded pages (Layout provides Suspense). */
export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/welcome" element={<Welcome />} />
              {/* "/" becomes the Chat page in segment F5; until then it shows the Catalogue. */}
              <Route
                path="/"
                element={
                  <RequireRole>
                    <Catalogue />
                  </RequireRole>
                }
              />
              <Route
                path="/catalogue"
                element={
                  <RequireRole>
                    <Catalogue />
                  </RequireRole>
                }
              />
              <Route
                path="/admin"
                element={
                  <RequireRole roles={['admin']}>
                    <Admin />
                  </RequireRole>
                }
              />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}
