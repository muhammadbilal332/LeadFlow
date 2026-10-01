import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import OutreachCampaignsPage from '../pages/OutreachCampaignsPage';
import { AuthProvider } from '../hooks/useAuth';
import { ToastProvider } from '../hooks/useToast';
import * as outreachApi from '../services/outreachApi';

vi.mock('../services/outreachApi');

function renderPage() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <ToastProvider>
          <OutreachCampaignsPage />
        </ToastProvider>
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('OutreachCampaignsPage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(outreachApi.listSequences).mockResolvedValue({ sequences: [] });
  });

  it('shows an empty state with no campaigns', async () => {
    vi.mocked(outreachApi.listCampaigns).mockResolvedValue({ campaigns: [] });

    renderPage();

    expect(await screen.findByText(/no campaigns yet/i)).toBeInTheDocument();
  });

  it('lists campaigns with their status and contact counts', async () => {
    vi.mocked(outreachApi.listCampaigns).mockResolvedValue({
      campaigns: [
        {
          id: 'camp-1', business_id: 'biz-1', name: 'Q1 Cold Outreach', description: null,
          status: 'running', sender_name: 'Alex', sender_email: 'alex@test.com', reply_to: null,
          sequence_id: 'seq-1', approved_by: 'user-1', approved_at: '2026-01-01',
          contactCounts: { sent: 3, pending: 2 }, created_at: '', updated_at: '',
        },
      ],
    });

    renderPage();

    expect(await screen.findByText('Q1 Cold Outreach')).toBeInTheDocument();
    expect(screen.getByText('running')).toBeInTheDocument();
    expect(screen.getByText(/3 sent, 2 pending/)).toBeInTheDocument();
  });

  it('creates a new campaign from the form', async () => {
    vi.mocked(outreachApi.listCampaigns).mockResolvedValue({ campaigns: [] });
    vi.mocked(outreachApi.listSequences).mockResolvedValue({
      sequences: [{ id: 'seq-1', business_id: 'biz-1', name: 'Cold Intro', description: null, steps: [], created_at: '', updated_at: '' }],
    });
    vi.mocked(outreachApi.createCampaign).mockResolvedValue({ campaign: {} as any });

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /new campaign/i }));
    fireEvent.change(screen.getByPlaceholderText(/campaign name/i), { target: { value: 'Spring Push' } });
    fireEvent.change(screen.getByDisplayValue(/select a sequence/i), { target: { value: 'seq-1' } });
    fireEvent.click(screen.getByRole('button', { name: /create campaign/i }));

    await waitFor(() =>
      expect(outreachApi.createCampaign).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Spring Push', sequenceId: 'seq-1' })
      )
    );
  });
});
