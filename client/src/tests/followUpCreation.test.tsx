import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import FollowUpsPage from '../pages/FollowUpsPage';
import { ToastProvider } from '../hooks/useToast';
import * as followUpsApi from '../services/followUpsApi';
import * as leadsApi from '../services/leadsApi';
import * as outreachApi from '../services/outreachApi';
import { sampleLead } from './fixtures';

vi.mock('../services/followUpsApi');
vi.mock('../services/leadsApi');
vi.mock('../services/outreachApi');

describe('FollowUpsPage (creation)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(followUpsApi.listFollowUps).mockResolvedValue({ followUps: [] });
    vi.mocked(leadsApi.listLeads).mockResolvedValue({
      leads: [sampleLead({ name: 'Follow-up Target' })],
      pagination: { page: 1, pageSize: 200, total: 1, totalPages: 1 },
    });
    vi.mocked(outreachApi.getFollowUpQueue).mockResolvedValue({
      queue: { '3-day': [], '7-day': [], '14-day': [], '28-day': [], overdue: [] },
      counts: { '3-day': 0, '7-day': 0, '14-day': 0, '28-day': 0, overdue: 0 },
    });
  });

  it('shows an empty state with no manual follow-ups scheduled', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ToastProvider>
          <FollowUpsPage />
        </ToastProvider>
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: /manual reminders/i }));
    expect(await screen.findByText(/no manual reminders scheduled/i)).toBeInTheDocument();
  });

  it('creates a new manual reminder for a selected lead', async () => {
    vi.mocked(followUpsApi.createFollowUp).mockResolvedValue({
      followUp: {
        id: 'fu-1', business_id: 'biz-1', lead_id: 'lead-1', user_id: null, type: 'Call',
        scheduled_at: new Date().toISOString(), completed_at: null, notes: null, created_at: '',
      },
    });

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ToastProvider>
          <FollowUpsPage />
        </ToastProvider>
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: /manual reminders/i }));
    await user.click(screen.getByRole('button', { name: /new reminder/i }));
    await user.selectOptions(screen.getByLabelText(/select lead/i), 'lead-1');
    await user.type(screen.getByLabelText(/scheduled date and time/i), '2030-01-01T10:00');
    await user.click(screen.getByRole('button', { name: /^schedule$/i }));

    await waitFor(() => {
      expect(followUpsApi.createFollowUp).toHaveBeenCalledWith(
        expect.objectContaining({ leadId: 'lead-1', type: 'Call' })
      );
    });
  });
});
