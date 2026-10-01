import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import DeveloperRoute from '../components/DeveloperRoute';
import { AuthProvider } from '../hooks/useAuth';
import * as authApi from '../services/authApi';

vi.mock('../services/authApi');

function DummyDeveloperPage() {
  return <div>Secret developer dashboard</div>;
}

function DummyLoginPage() {
  return <div>Developer login page</div>;
}

function renderWithToken(role: 'owner' | 'sales' | 'developer') {
  localStorage.setItem('leadflow_token', 'fake-token');
  vi.mocked(authApi.getMe).mockResolvedValue({
    user: { id: 'u1', business_id: 'b1', name: 'Test User', email: 'test@example.com', role, is_active: true, created_at: '', updated_at: '' },
  });
  vi.mocked(authApi.getBusiness).mockResolvedValue({
    business: { id: 'b1', name: 'Test Biz', email: null, phone: null, industry: null, slug: 'test-biz', created_at: '', updated_at: '' },
  });

  return render(
    <MemoryRouter initialEntries={['/developer/dashboard']}>
      <AuthProvider>
        <Routes>
          <Route path="/developer/login" element={<DummyLoginPage />} />
          <Route
            path="/developer/dashboard"
            element={
              <DeveloperRoute>
                <DummyDeveloperPage />
              </DeveloperRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('DeveloperRoute', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('redirects unauthenticated users to /developer/login', async () => {
    render(
      <MemoryRouter initialEntries={['/developer/dashboard']}>
        <AuthProvider>
          <Routes>
            <Route path="/developer/login" element={<DummyLoginPage />} />
            <Route
              path="/developer/dashboard"
              element={
                <DeveloperRoute>
                  <DummyDeveloperPage />
                </DeveloperRoute>
              }
            />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );

    expect(await screen.findByText('Developer login page')).toBeInTheDocument();
    expect(screen.queryByText('Secret developer dashboard')).not.toBeInTheDocument();
  });

  it('shows an access-denied message (not the dashboard) for a logged-in sales user', async () => {
    renderWithToken('sales');
    expect(await screen.findByText('Access denied')).toBeInTheDocument();
    expect(screen.queryByText('Secret developer dashboard')).not.toBeInTheDocument();
  });

  it('shows an access-denied message for a logged-in owner (owner has no automatic developer access)', async () => {
    renderWithToken('owner');
    expect(await screen.findByText('Access denied')).toBeInTheDocument();
    expect(screen.queryByText('Secret developer dashboard')).not.toBeInTheDocument();
  });

  it('renders the dashboard for a real developer account', async () => {
    renderWithToken('developer');
    expect(await screen.findByText('Secret developer dashboard')).toBeInTheDocument();
  });
});
