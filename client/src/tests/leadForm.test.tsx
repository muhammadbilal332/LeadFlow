import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import NewLeadPage from '../pages/NewLeadPage';
import { AuthProvider } from '../hooks/useAuth';
import { ToastProvider } from '../hooks/useToast';
import * as leadsApi from '../services/leadsApi';
import { sampleLead } from './fixtures';

vi.mock('../services/leadsApi');

describe('NewLeadPage (lead creation)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('validates that a name is required before submitting', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/leads/new']}>
        <AuthProvider>
          <ToastProvider>
            <Routes>
              <Route path="/leads/new" element={<NewLeadPage />} />
              <Route path="/leads/:id" element={<div>Lead detail page</div>} />
            </Routes>
          </ToastProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: /save lead/i }));
    expect(await screen.findByText(/name is required/i)).toBeInTheDocument();
    expect(leadsApi.createLead).not.toHaveBeenCalled();
  });

  it('submits the form and navigates to the new lead detail page', async () => {
    vi.mocked(leadsApi.createLead).mockResolvedValue({
      lead: sampleLead({ name: 'Jane Prospect' }),
    });

    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/leads/new']}>
        <AuthProvider>
          <ToastProvider>
            <Routes>
              <Route path="/leads/new" element={<NewLeadPage />} />
              <Route path="/leads/:id" element={<div>Lead detail page</div>} />
            </Routes>
          </ToastProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText(/name \*/i), 'Jane Prospect');
    await user.click(screen.getByRole('button', { name: /save lead/i }));

    expect(await screen.findByText('Lead detail page')).toBeInTheDocument();
    expect(leadsApi.createLead).toHaveBeenCalledWith(expect.objectContaining({ name: 'Jane Prospect' }));
  });
});
