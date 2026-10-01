import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ProtectedRoute from '../components/ProtectedRoute';
import { AuthProvider } from '../hooks/useAuth';

function DummyProtectedPage() {
  return <div>Secret dashboard content</div>;
}

function DummyLoginPage() {
  return <div>Login page</div>;
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('redirects unauthenticated users to /login', async () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<DummyLoginPage />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DummyProtectedPage />
                </ProtectedRoute>
              }
            />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );

    expect(await screen.findByText('Login page')).toBeInTheDocument();
    expect(screen.queryByText('Secret dashboard content')).not.toBeInTheDocument();
  });
});
