import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import { ToastProvider } from './hooks/useToast';
import ProtectedRoute from './components/ProtectedRoute';
import RoleRoute from './components/RoleRoute';
import DeveloperRoute from './components/DeveloperRoute';
import AppLayout from './layouts/AppLayout';
import AuthLayout from './layouts/AuthLayout';
import DeveloperLayout from './layouts/DeveloperLayout';

import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import PersonEmailsPage from './pages/PersonEmailsPage';
import PersonEmailDetailPage from './pages/PersonEmailDetailPage';
import LeadsPage from './pages/LeadsPage';
import NewLeadPage from './pages/NewLeadPage';
import LeadDetailPage from './pages/LeadDetailPage';
import PipelinePage from './pages/PipelinePage';
import FollowUpsPage from './pages/FollowUpsPage';
import ReportsPage from './pages/ReportsPage';
import SettingsUsersPage from './pages/SettingsUsersPage';
import SettingsBusinessPage from './pages/SettingsBusinessPage';
import SettingsRoutingPage from './pages/SettingsRoutingPage';
import SettingsAutomationsPage from './pages/SettingsAutomationsPage';
import SettingsIntegrationsPage from './pages/SettingsIntegrationsPage';
import SettingsApiKeysPage from './pages/SettingsApiKeysPage';
import InboxPage from './pages/InboxPage';
import SentPage from './pages/SentPage';
import NewLeadsQueuePage from './pages/NewLeadsQueuePage';
import PublicFormPage from './pages/PublicFormPage';
import OutreachOverviewPage from './pages/OutreachOverviewPage';
import OutreachContactsPage from './pages/OutreachContactsPage';
import OutreachSequencesPage from './pages/OutreachSequencesPage';
import OutreachDraftsPage from './pages/OutreachDraftsPage';
import OutreachSuppressionsPage from './pages/OutreachSuppressionsPage';
import NotFoundPage from './pages/NotFoundPage';

import DeveloperLoginPage from './pages/developer/DeveloperLoginPage';
import DeveloperOverviewPage from './pages/developer/DeveloperOverviewPage';
import DeveloperUsersPage from './pages/developer/DeveloperUsersPage';
import DeveloperOutreachPage from './pages/developer/DeveloperOutreachPage';
import DeveloperAutomationPage from './pages/developer/DeveloperAutomationPage';
import DeveloperHealthPage from './pages/developer/DeveloperHealthPage';
import DeveloperProvidersPage from './pages/developer/DeveloperProvidersPage';
import DeveloperUsagePage from './pages/developer/DeveloperUsagePage';
import DeveloperLogsPage from './pages/developer/DeveloperLogsPage';
import DeveloperAuditPage from './pages/developer/DeveloperAuditPage';
import DeveloperSettingsPage from './pages/developer/DeveloperSettingsPage';

export default function App(): React.ReactElement {
  return (
    <AuthProvider>
      <ToastProvider>
        <Routes>
          {/* Public, unauthenticated form route — no app chrome, no auth required. */}
          <Route path="/f/:businessSlug/:formSlug" element={<PublicFormPage />} />

          <Route element={<AuthLayout />}>
            <Route path="/login" element={<LoginPage />} />
          </Route>

          {/* Developer/Admin console — entirely separate login and layout from the CRM. */}
          <Route path="/developer/login" element={<DeveloperLoginPage />} />
          <Route
            element={
              <DeveloperRoute>
                <DeveloperLayout />
              </DeveloperRoute>
            }
          >
            <Route path="/developer" element={<Navigate to="/developer/dashboard" replace />} />
            <Route path="/developer/dashboard" element={<DeveloperOverviewPage />} />
            <Route path="/developer/users" element={<DeveloperUsersPage />} />
            <Route path="/developer/outreach" element={<DeveloperOutreachPage />} />
            <Route path="/developer/automation" element={<DeveloperAutomationPage />} />
            <Route path="/developer/health" element={<DeveloperHealthPage />} />
            <Route path="/developer/providers" element={<DeveloperProvidersPage />} />
            <Route path="/developer/usage" element={<DeveloperUsagePage />} />
            <Route path="/developer/logs" element={<DeveloperLogsPage />} />
            <Route path="/developer/audit" element={<DeveloperAuditPage />} />
            <Route path="/developer/settings" element={<DeveloperSettingsPage />} />
          </Route>

          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/dashboard/people/:userId" element={<PersonEmailsPage />} />
            <Route path="/dashboard/people/:userId/emails/:messageId" element={<PersonEmailDetailPage />} />
            <Route path="/inbox" element={<InboxPage />} />
            <Route path="/sent" element={<SentPage />} />
            <Route path="/leads" element={<LeadsPage />} />
            <Route path="/leads/queue" element={<NewLeadsQueuePage />} />
            <Route path="/leads/new" element={<NewLeadPage />} />
            <Route path="/leads/:id" element={<LeadDetailPage />} />
            <Route path="/pipeline" element={<PipelinePage />} />
            <Route path="/follow-ups" element={<FollowUpsPage />} />
            <Route path="/outreach" element={<OutreachOverviewPage />} />
            <Route path="/outreach/contacts" element={<OutreachContactsPage />} />
            <Route path="/outreach/sequences" element={<OutreachSequencesPage />} />
            <Route path="/outreach/drafts" element={<OutreachDraftsPage />} />
            <Route path="/outreach/suppressions" element={<OutreachSuppressionsPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/settings/business" element={<SettingsBusinessPage />} />
            <Route
              path="/settings/users"
              element={
                <RoleRoute roles={['owner', 'manager']}>
                  <SettingsUsersPage />
                </RoleRoute>
              }
            />
            <Route
              path="/settings/routing"
              element={
                <RoleRoute roles={['owner', 'manager']}>
                  <SettingsRoutingPage />
                </RoleRoute>
              }
            />
            <Route
              path="/settings/automations"
              element={
                <RoleRoute roles={['owner', 'manager']}>
                  <SettingsAutomationsPage />
                </RoleRoute>
              }
            />
            <Route
              path="/settings/integrations"
              element={
                <RoleRoute roles={['owner', 'manager']}>
                  <SettingsIntegrationsPage />
                </RoleRoute>
              }
            />
            <Route
              path="/settings/api-keys"
              element={
                <RoleRoute roles={['owner', 'manager']}>
                  <SettingsApiKeysPage />
                </RoleRoute>
              }
            />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </ToastProvider>
    </AuthProvider>
  );
}
