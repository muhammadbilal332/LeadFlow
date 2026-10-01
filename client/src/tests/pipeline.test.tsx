import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import PipelinePage from '../pages/PipelinePage';
import { ToastProvider } from '../hooks/useToast';
import * as dashboardApi from '../services/dashboardApi';
import * as leadsApi from '../services/leadsApi';
import { Lead } from '../types';
import { sampleLead as sampleLeadFixture } from './fixtures';

vi.mock('../services/dashboardApi');
vi.mock('../services/leadsApi');

const sampleLead: Lead = sampleLeadFixture({
  assigned_user_name: 'Alex', name: 'Pipeline Lead', company: 'Acme', budget: '1000', score: 55,
});

describe('PipelinePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders leads grouped into their status columns', async () => {
    vi.mocked(dashboardApi.getPipeline).mockResolvedValue({
      columns: [
        { status: 'New', leads: [sampleLead] },
        { status: 'Contacted', leads: [] },
        { status: 'Qualified', leads: [] },
        { status: 'Proposal', leads: [] },
        { status: 'Negotiation', leads: [] },
        { status: 'Won', leads: [] },
        { status: 'Lost', leads: [] },
      ],
    });

    render(
      <MemoryRouter>
        <ToastProvider>
          <PipelinePage />
        </ToastProvider>
      </MemoryRouter>
    );

    expect(await screen.findByText('Pipeline Lead')).toBeInTheDocument();
  });

  it('moves a lead to a new status via its dropdown', async () => {
    vi.mocked(dashboardApi.getPipeline).mockResolvedValue({
      columns: [
        { status: 'New', leads: [sampleLead] },
        { status: 'Contacted', leads: [] },
        { status: 'Qualified', leads: [] },
        { status: 'Proposal', leads: [] },
        { status: 'Negotiation', leads: [] },
        { status: 'Won', leads: [] },
        { status: 'Lost', leads: [] },
      ],
    });
    vi.mocked(leadsApi.updateLead).mockResolvedValue({ lead: { ...sampleLead, status: 'Contacted' } });

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ToastProvider>
          <PipelinePage />
        </ToastProvider>
      </MemoryRouter>
    );

    await screen.findByText('Pipeline Lead');
    await user.selectOptions(screen.getByLabelText(/change status for pipeline lead/i), 'Contacted');

    await waitFor(() => {
      expect(leadsApi.updateLead).toHaveBeenCalledWith('lead-1', { status: 'Contacted' });
    });
  });
});
