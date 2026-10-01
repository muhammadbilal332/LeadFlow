import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import InboxPage from '../pages/InboxPage';
import { AuthProvider } from '../hooks/useAuth';
import { ToastProvider } from '../hooks/useToast';
import * as leadsApi from '../services/leadsApi';
import { sampleLead } from './fixtures';

vi.mock('../services/leadsApi');

describe('InboxPage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('shows "Inbox zero" when there are no unworked leads', async () => {
    vi.mocked(leadsApi.listLeads).mockResolvedValue({ leads: [], pagination: { page: 1, pageSize: 50, total: 0, totalPages: 0 } });

    render(
      <MemoryRouter>
        <AuthProvider>
          <ToastProvider>
            <InboxPage />
          </ToastProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    expect(await screen.findByText(/inbox zero/i)).toBeInTheDocument();
    expect(leadsApi.listLeads).toHaveBeenCalledWith(expect.objectContaining({ unworkedOnly: true }));
  });

  it('shows a new lead card with priority and lets the user mark it contacted', async () => {
    const lead = sampleLead({ name: 'Ahmed Khan', priority: 'Hot', score: 91, source: 'Instagram', sla_state: 'Pending' });
    vi.mocked(leadsApi.listLeads).mockResolvedValue({ leads: [lead], pagination: { page: 1, pageSize: 50, total: 1, totalPages: 1 } });
    vi.mocked(leadsApi.updateLead).mockResolvedValue({ lead: { ...lead, status: 'Contacted' } });

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AuthProvider>
          <ToastProvider>
            <InboxPage />
          </ToastProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    expect(await screen.findByText('Ahmed Khan')).toBeInTheDocument();
    expect(screen.getByText('Hot')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /contact/i }));

    await waitFor(() => {
      expect(leadsApi.updateLead).toHaveBeenCalledWith(lead.id, { status: 'Contacted' });
    });
  });
});
