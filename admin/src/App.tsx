import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './components/AuthProvider';
import { ProtectedRoute } from './components/ProtectedRoute';
import { DashboardLayout } from './layouts/DashboardLayout';

import { LoginPage } from './pages/LoginPage';
import { OverviewPage } from './pages/OverviewPage';
import { ParticipantsPage } from './pages/ParticipantsPage';
import { ReferralsPage } from './pages/ReferralsPage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { SettingsPage } from './pages/SettingsPage';
import { ActivityPage } from './pages/ActivityPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 1000 * 30, // 30 seconds
    },
  },
});

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 3500,
              style: {
                background: '#ffffff',
                color: '#111827',
                border: '1px solid #e5e7eb',
                fontSize: '13px',
              },
            }}
          />
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <OverviewPage />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/participants"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <ParticipantsPage />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/referrals"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <ReferralsPage />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/leaderboard"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <LeaderboardPage />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/activity"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <ActivityPage />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <SettingsPage />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
