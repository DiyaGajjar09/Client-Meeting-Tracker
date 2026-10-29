import { useState, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout.jsx';
import { LoadingState } from './components/common/States.jsx';
import { ToastProvider } from './components/common/ToastNotification.jsx';

// Lazy-loaded route pages for optimal performance and chunking
const LandingPage = lazy(() => import('./pages/LandingPage.jsx'));
const Login = lazy(() => import('./pages/Login.jsx'));
const SignUp = lazy(() => import('./pages/SignUp.jsx'));
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const NewMeeting = lazy(() => import('./pages/NewMeeting.jsx'));
const ReviewItems = lazy(() => import('./pages/ReviewItems.jsx'));
const Clarification = lazy(() => import('./pages/Clarification.jsx'));
const Duplicates = lazy(() => import('./pages/Duplicates.jsx'));
const MeetingHistory = lazy(() => import('./pages/MeetingHistory.jsx'));
const MeetingDetails = lazy(() => import('./pages/MeetingDetails.jsx'));
const ExportPage = lazy(() => import('./pages/ExportPage.jsx'));
const Settings = lazy(() => import('./pages/Settings.jsx'));
const Profile = lazy(() => import('./pages/Profile.jsx'));
const NotFound = lazy(() => import('./pages/NotFound.jsx'));

function PageLoader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <LoadingState message="Loading page..." />
    </div>
  );
}

function AppShell() {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <AppLayout searchQuery={searchQuery} onSearchChange={setSearchQuery}>
      <Suspense fallback={<PageLoader />}>
        <Outlet context={{ searchQuery }} />
      </Suspense>
    </AppLayout>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <Suspense fallback={<PageLoader />}>
          <Routes>
          {/* Public Marketing Landing Page */}
          <Route path="/" element={<LandingPage />} />

          {/* Authentication Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/signin" element={<Navigate to="/login" replace />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/register" element={<Navigate to="/signup" replace />} />
          <Route path="/auth" element={<Navigate to="/login" replace />} />

          {/* Authenticated / SaaS Application Routes with Shared Layout Shell */}
          <Route path="/app" element={<AppShell />}>
            <Route index element={<Navigate to="/app/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="new-meeting" element={<NewMeeting />} />
            <Route path="review" element={<Navigate to="/app/review/m1" replace />} />
            <Route path="review/:meetingId" element={<ReviewItems />} />
            <Route path="clarification" element={<Clarification />} />
            <Route path="duplicates" element={<Duplicates />} />
            <Route path="history" element={<MeetingHistory />} />
            <Route path="history/:meetingId" element={<MeetingDetails />} />
            <Route path="export" element={<ExportPage />} />
            <Route path="settings" element={<Settings />} />
            <Route path="profile" element={<Profile />} />
          </Route>

          {/* Legacy / Direct Route Compatibility Redirects */}
          <Route path="/dashboard" element={<Navigate to="/app/dashboard" replace />} />
          <Route path="/new-meeting" element={<Navigate to="/app/new-meeting" replace />} />
          <Route path="/review" element={<Navigate to="/app/review/m1" replace />} />
          <Route path="/clarification" element={<Navigate to="/app/clarification" replace />} />
          <Route path="/duplicates" element={<Navigate to="/app/duplicates" replace />} />
          <Route path="/history" element={<Navigate to="/app/history" replace />} />
          <Route path="/export" element={<Navigate to="/app/export" replace />} />
          <Route path="/settings" element={<Navigate to="/app/settings" replace />} />
          <Route path="/profile" element={<Navigate to="/app/profile" replace />} />

          {/* Custom 404 Page */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      </ToastProvider>
    </BrowserRouter>
  );
}
