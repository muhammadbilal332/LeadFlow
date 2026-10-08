import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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
  assigned_user_name: 'Alex', name: 'Pipeline Lead', company: 'Acme', score: 55,
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

  it('moves a lead to a new status by dragging its card onto a column', async () => {
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

    const { container } = render(
      <MemoryRouter>
        <ToastProvider>
          <PipelinePage />
        </ToastProvider>
      </MemoryRouter>
    );

    const card = (await screen.findByText('Pipeline Lead')).closest('a')!;
    const contactedColumn = container.querySelector('a[href="/leads?status=Contacted"]')!.closest('.rounded-2xl')!;

    fireEvent.dragStart(card);
    fireEvent.drop(contactedColumn);

    await waitFor(() => {
      expect(leadsApi.updateLead).toHaveBeenCalledWith('lead-1', { status: 'Contacted' });
    });
  });

  it('a lead card links to the lead detail page and has no status dropdown', async () => {
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

    const card = (await screen.findByText('Pipeline Lead')).closest('a');
    expect(card).toHaveAttribute('href', '/leads/lead-1');
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });
});
