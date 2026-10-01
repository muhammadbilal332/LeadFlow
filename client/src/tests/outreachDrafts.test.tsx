import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import OutreachDraftsPage from '../pages/OutreachDraftsPage';
import { AuthProvider } from '../hooks/useAuth';
import { ToastProvider } from '../hooks/useToast';
import * as outreachApi from '../services/outreachApi';

vi.mock('../services/outreachApi');

function renderPage() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <ToastProvider>
          <OutreachDraftsPage />
        </ToastProvider>
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('OutreachDraftsPage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('shows an empty state when there are no drafts pending review', async () => {
    vi.mocked(outreachApi.listDrafts).mockResolvedValue({ drafts: [] });

    renderPage();

    expect(await screen.findByText(/no drafts pending review/i)).toBeInTheDocument();
  });

  it('renders a draft with its quality status and blocks approval when blocked', async () => {
    vi.mocked(outreachApi.listDrafts).mockResolvedValue({
      drafts: [
        {
          id: 'draft-1',
          business_id: 'biz-1',
          campaign_contact_id: 'cc-1',
          step_order: 1,
          subject: 'Quick question for Acme',
          ai_raw_body: 'Hi Dana, ...',
          naturalized_body: 'Hi Dana, ...',
          final_body: null,
          quality_status: 'blocked',
          quality_issues: [{ code: 'suppressed_recipient', severity: 'blocking', message: 'This recipient is on the suppression list.' }],
          status: 'draft',
          approved_by: null,
          approved_at: null,
          created_at: '',
          updated_at: '',
        },
      ],
    });

    renderPage();

    expect(await screen.findByText(/quality: blocked/i)).toBeInTheDocument();
    expect(screen.getByText(/suppression list/i)).toBeInTheDocument();

    const approveButton = screen.getByRole('button', { name: /approve/i });
    expect(approveButton).toBeDisabled();
  });

  it('approves a draft and calls the API', async () => {
    vi.mocked(outreachApi.listDrafts).mockResolvedValue({
      drafts: [
        {
          id: 'draft-2',
          business_id: 'biz-1',
          campaign_contact_id: 'cc-2',
          step_order: 1,
          subject: 'Quick question',
          ai_raw_body: 'Hi there, ...',
          naturalized_body: 'Hi there, ...',
          final_body: null,
          quality_status: 'passed',
          quality_issues: [],
          status: 'draft',
          approved_by: null,
          approved_at: null,
          created_at: '',
          updated_at: '',
        },
      ],
    });
    vi.mocked(outreachApi.approveDraft).mockResolvedValue({ draft: {} as any, sendOutcome: 'not_running' });

    renderPage();

    const approveButton = await screen.findByRole('button', { name: /approve/i });
    expect(approveButton).not.toBeDisabled();
    fireEvent.click(approveButton);

    await waitFor(() => expect(outreachApi.approveDraft).toHaveBeenCalledWith('draft-2'));
  });
});
