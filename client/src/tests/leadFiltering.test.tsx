import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import LeadsPage from '../pages/LeadsPage';
import { AuthProvider } from '../hooks/useAuth';
import { ToastProvider } from '../hooks/useToast';
import * as leadsApi from '../services/leadsApi';
import * as usersApi from '../services/usersApi';

vi.mock('../services/leadsApi');
vi.mock('../services/usersApi');

const emptyResult = { leads: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } };

describe('LeadsPage (filtering)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(usersApi.listUsers).mockResolvedValue({ users: [] });
  });

  it('loads leads on mount and shows an empty state when there are none', async () => {
    vi.mocked(leadsApi.listLeads).mockResolvedValue(emptyResult);

    render(
      <MemoryRouter>
        <AuthProvider>
          <ToastProvider>
            <LeadsPage />
          </ToastProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    expect(await screen.findByText(/no leads found/i)).toBeInTheDocument();
    expect(leadsApi.listLeads).toHaveBeenCalled();
  });

  it('re-fetches leads with the selected status filter', async () => {
    vi.mocked(leadsApi.listLeads).mockResolvedValue(emptyResult);

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AuthProvider>
          <ToastProvider>
            <LeadsPage />
          </ToastProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => expect(leadsApi.listLeads).toHaveBeenCalled());
    vi.mocked(leadsApi.listLeads).mockClear();

    await user.selectOptions(screen.getByLabelText(/filter by status/i), 'Qualified');

    await waitFor(() => {
      expect(leadsApi.listLeads).toHaveBeenCalledWith(expect.objectContaining({ status: 'Qualified' }));
    });
  });
});
