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
import SignupPage from './pages/SignupPage';
import DashboardPage from './pages/DashboardPage';
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
import FormsPage from './pages/FormsPage';
import FormEditorPage from './pages/FormEditorPage';
import PublicFormPage from './pages/PublicFormPage';
import CampaignsPage from './pages/CampaignsPage';
import CampaignDetailPage from './pages/CampaignDetailPage';
import OutreachOverviewPage from './pages/OutreachOverviewPage';
import OutreachContactsPage from './pages/OutreachContactsPage';
import OutreachSequencesPage from './pages/OutreachSequencesPage';
import OutreachCampaignsPage from './pages/OutreachCampaignsPage';
import OutreachCampaignDetailPage from './pages/OutreachCampaignDetailPage';
import OutreachDraftsPage from './pages/OutreachDraftsPage';
import OutreachRepliesPage from './pages/OutreachRepliesPage';
import OutreachSuppressionsPage from './pages/OutreachSuppressionsPage';
import NotFoundPage from './pages/NotFoundPage';

import DeveloperLoginPage from './pages/developer/DeveloperLoginPage';
import DeveloperOverviewPage from './pages/developer/DeveloperOverviewPage';
import DeveloperBusinessesPage from './pages/developer/DeveloperBusinessesPage';
import DeveloperBusinessDetailPage from './pages/developer/DeveloperBusinessDetailPage';
import DeveloperUsersPage from './pages/developer/DeveloperUsersPage';
import DeveloperLeadsPage from './pages/developer/DeveloperLeadsPage';
import DeveloperOutreachPage from './pages/developer/DeveloperOutreachPage';
import DeveloperN8nPage from './pages/developer/DeveloperN8nPage';
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
            <Route path="/signup" element={<SignupPage />} />
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
            <Route path="/developer/businesses" element={<DeveloperBusinessesPage />} />
            <Route path="/developer/businesses/:id" element={<DeveloperBusinessDetailPage />} />
            <Route path="/developer/users" element={<DeveloperUsersPage />} />
            <Route path="/developer/leads" element={<DeveloperLeadsPage />} />
            <Route path="/developer/outreach" element={<DeveloperOutreachPage />} />
            <Route path="/developer/n8n" element={<DeveloperN8nPage />} />
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
            <Route path="/inbox" element={<InboxPage />} />
            <Route path="/leads" element={<LeadsPage />} />
            <Route path="/leads/new" element={<NewLeadPage />} />
            <Route path="/leads/:id" element={<LeadDetailPage />} />
            <Route path="/pipeline" element={<PipelinePage />} />
            <Route path="/follow-ups" element={<FollowUpsPage />} />
            <Route path="/forms" element={<FormsPage />} />
            <Route
              path="/forms/new"
              element={
                <RoleRoute roles={['owner']}>
                  <FormEditorPage />
                </RoleRoute>
              }
            />
            <Route
              path="/forms/:id"
              element={
                <RoleRoute roles={['owner']}>
                  <FormEditorPage />
                </RoleRoute>
              }
            />
            <Route path="/campaigns" element={<CampaignsPage />} />
            <Route path="/campaigns/:id" element={<CampaignDetailPage />} />
            <Route path="/outreach" element={<OutreachOverviewPage />} />
            <Route path="/outreach/contacts" element={<OutreachContactsPage />} />
            <Route path="/outreach/sequences" element={<OutreachSequencesPage />} />
            <Route path="/outreach/campaigns" element={<OutreachCampaignsPage />} />
            <Route path="/outreach/campaigns/:id" element={<OutreachCampaignDetailPage />} />
            <Route path="/outreach/drafts" element={<OutreachDraftsPage />} />
            <Route path="/outreach/replies" element={<OutreachRepliesPage />} />
            <Route path="/outreach/suppressions" element={<OutreachSuppressionsPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/settings/business" element={<SettingsBusinessPage />} />
            <Route
              path="/settings/users"
              element={
                <RoleRoute roles={['owner']}>
                  <SettingsUsersPage />
                </RoleRoute>
              }
            />
            <Route
              path="/settings/routing"
              element={
                <RoleRoute roles={['owner']}>
                  <SettingsRoutingPage />
                </RoleRoute>
              }
            />
            <Route
              path="/settings/automations"
              element={
                <RoleRoute roles={['owner']}>
                  <SettingsAutomationsPage />
                </RoleRoute>
              }
            />
            <Route
              path="/settings/integrations"
              element={
                <RoleRoute roles={['owner']}>
                  <SettingsIntegrationsPage />
                </RoleRoute>
              }
            />
            <Route
              path="/settings/api-keys"
              element={
                <RoleRoute roles={['owner']}>
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
