import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DeveloperLoginPage from '../pages/developer/DeveloperLoginPage';
import * as authApi from '../services/authApi';
import { ApiError } from '../lib/api';

vi.mock('../services/authApi');

function renderPage() {
  return render(
    <MemoryRouter>
      <DeveloperLoginPage />
    </MemoryRouter>
  );
}

describe('DeveloperLoginPage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('shows a clear error on invalid credentials, without storing a token', async () => {
    vi.mocked(authApi.login).mockRejectedValue(new ApiError('Invalid email or password', 401));

    renderPage();
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'nobody@test.com' } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'wrongpassword' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/invalid email or password/i);
    expect(localStorage.getItem('leadflow_token')).toBeNull();
  });

  it('refuses access and never stores a token when the account is not a developer', async () => {
    vi.mocked(authApi.login).mockResolvedValue({
      token: 'some-real-token',
      user: { id: 'u1', name: 'Sales Sam', email: 'sam@test.com', role: 'sales', businessId: 'b1' },
    });

    renderPage();
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'sam@test.com' } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'correctpassword' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/does not have developer access/i);
    expect(localStorage.getItem('leadflow_token')).toBeNull();
  });

  it('toggles password visibility', async () => {
    renderPage();
    const passwordInput = screen.getByLabelText(/^password$/i) as HTMLInputElement;
    expect(passwordInput.type).toBe('password');

    fireEvent.click(screen.getByLabelText(/show password/i));
    expect(passwordInput.type).toBe('text');
  });

  it('shows a validation message when submitting with empty fields', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/enter both/i);
    expect(authApi.login).not.toHaveBeenCalled();
  });

  it('shows a loading state while signing in', async () => {
    let resolveLogin: (value: any) => void = () => {};
    vi.mocked(authApi.login).mockReturnValue(new Promise((resolve) => { resolveLogin = resolve; }));

    renderPage();
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'dev@test.com' } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByRole('button', { name: /signing in/i })).toBeDisabled();

    resolveLogin({ token: 't', user: { id: 'u1', name: 'Dev', email: 'dev@test.com', role: 'sales', businessId: 'b1' } });
    await waitFor(() => expect(screen.queryByRole('button', { name: /signing in/i })).not.toBeInTheDocument());
  });
});
