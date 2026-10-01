import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from '../pages/LoginPage';
import { AuthProvider } from '../hooks/useAuth';
import * as authApi from '../services/authApi';

vi.mock('../services/authApi');

describe('LoginPage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('logs in successfully and stores a token', async () => {
    vi.mocked(authApi.login).mockResolvedValue({
      token: 'fake-token',
      user: { id: '1', name: 'Owner', email: 'owner@test.com', role: 'owner', businessId: 'biz-1' },
    });
    vi.mocked(authApi.getMe).mockResolvedValue({
      user: { id: '1', business_id: 'biz-1', name: 'Owner', email: 'owner@test.com', role: 'owner', is_active: true, created_at: '', updated_at: '' },
    });
    vi.mocked(authApi.getBusiness).mockResolvedValue({
      business: { id: 'biz-1', name: 'Test Biz', email: null, phone: null, industry: null, slug: 'test-biz', created_at: '', updated_at: '' },
    });

    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/login']}>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText(/email address/i), 'owner@test.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() => {
      expect(authApi.login).toHaveBeenCalledWith({ email: 'owner@test.com', password: 'password123' });
    });
    await waitFor(() => {
      expect(localStorage.getItem('leadflow_token')).toBe('fake-token');
    });
  });

  it('shows an error message on invalid credentials', async () => {
    const { ApiError } = await import('../lib/api');
    vi.mocked(authApi.login).mockRejectedValue(new ApiError('Invalid email or password', 401));

    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/login']}>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText(/email address/i), 'owner@test.com');
    await user.type(screen.getByLabelText(/password/i), 'wrongpassword');
    await user.click(screen.getByRole('button', { name: /log in/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/invalid email or password/i);
  });
});
