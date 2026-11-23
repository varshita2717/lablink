import { lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import Layout from './components/Layout.jsx';

const Welcome = lazy(() => import('./pages/Welcome.jsx'));
const NotFound = lazy(() => import('./pages/NotFound.jsx'));

/** Root component: error boundary, router and lazily loaded pages (Layout provides Suspense). */
export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/welcome" element={<Welcome />} />
            {/* Chat becomes the home page once sign-in exists (segment F2). */}
            <Route path="/" element={<Navigate to="/welcome" replace />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
