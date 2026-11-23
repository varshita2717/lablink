import { lazy } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import AuthProvider from './context/AuthContext.jsx';
import AgentProvider from './context/AgentContext.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import Layout from './components/Layout.jsx';
import RequireRole from './components/RequireRole.jsx';

const Welcome = lazy(() => import('./pages/Welcome.jsx'));
const Chat = lazy(() => import('./pages/Chat.jsx'));
const Catalogue = lazy(() => import('./pages/Catalogue.jsx'));
const EquipmentDetail = lazy(() => import('./pages/EquipmentDetail.jsx'));
const MyBookings = lazy(() => import('./pages/MyBookings.jsx'));
const MyRequests = lazy(() => import('./pages/MyRequests.jsx'));
const ApprovalQueue = lazy(() => import('./pages/ApprovalQueue.jsx'));
const Conflicts = lazy(() => import('./pages/Conflicts.jsx'));
const Admin = lazy(() => import('./pages/Admin.jsx'));
const NotFound = lazy(() => import('./pages/NotFound.jsx'));

/** Root component: error boundary, auth, router and lazily loaded pages (Layout provides Suspense). */
export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AgentProvider>
          <BrowserRouter>
            <Routes>
              <Route element={<Layout />}>
                <Route path="/welcome" element={<Welcome />} />
                <Route
                  path="/"
                  element={
                    <RequireRole>
                      <Chat />
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
                  path="/equipment/:id"
                  element={
                    <RequireRole>
                      <EquipmentDetail />
                    </RequireRole>
                  }
                />
                <Route
                  path="/my-bookings"
                  element={
                    <RequireRole>
                      <MyBookings />
                    </RequireRole>
                  }
                />
                <Route
                  path="/my-requests"
                  element={
                    <RequireRole roles={['student']}>
                      <MyRequests />
                    </RequireRole>
                  }
                />
                <Route
                  path="/approvals"
                  element={
                    <RequireRole roles={['faculty', 'admin']}>
                      <ApprovalQueue />
                    </RequireRole>
                  }
                />
                <Route
                  path="/conflicts"
                  element={
                    <RequireRole roles={['faculty', 'admin']}>
                      <Conflicts />
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
        </AgentProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
