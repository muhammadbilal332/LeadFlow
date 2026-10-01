import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import LeadDetailPage from '../pages/LeadDetailPage';
import { AuthProvider } from '../hooks/useAuth';
import { ToastProvider } from '../hooks/useToast';
import * as leadsApi from '../services/leadsApi';
import * as usersApi from '../services/usersApi';
import { ApiError } from '../lib/api';
import { sampleLead as makeSampleLead, sampleAiQualification } from './fixtures';

vi.mock('../services/leadsApi');
vi.mock('../services/usersApi');
vi.mock('../services/followUpsApi');

const sampleLead = makeSampleLead({ name: 'AI Test Lead', company: 'Acme', email: 'x@acme.com', score: 20 });

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/leads/lead-1']}>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/leads/:id" element={<LeadDetailPage />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('LeadDetailPage (AI qualification)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(leadsApi.getLead).mockResolvedValue({ lead: sampleLead });
    vi.mocked(leadsApi.listActivities).mockResolvedValue({ activities: [] });
    vi.mocked(leadsApi.listNotes).mockResolvedValue({ notes: [] });
    vi.mocked(leadsApi.listLeadFollowUps).mockResolvedValue({ followUps: [] });
    vi.mocked(leadsApi.getLatestAiQualification).mockResolvedValue({ qualification: null });
    vi.mocked(usersApi.listUsers).mockResolvedValue({ users: [] });
  });

  it('shows "no AI qualification available yet" before qualifying', async () => {
    renderPage();
    expect(await screen.findByText(/no ai qualification available yet/i)).toBeInTheDocument();
  });

  it('displays the AI result after a successful qualification', async () => {
    vi.mocked(leadsApi.qualifyLeadAi).mockResolvedValue({
      qualification: sampleAiQualification({
        score: 82, qualification: 'Hot',
        summary: 'Strong fit with urgent need.', reasoning: 'High budget and urgency.',
        recommended_action: 'Schedule a call today.',
      }),
    });

    const user = userEvent.setup();
    renderPage();
    await screen.findByText(/no ai qualification available yet/i);

    await user.click(screen.getByRole('button', { name: /qualify lead with ai/i }));

    expect(await screen.findByText(/strong fit with urgent need/i)).toBeInTheDocument();
    expect(screen.getByText('Hot')).toBeInTheDocument();
  });

  it('shows a clear message when AI is not configured, without crashing', async () => {
    vi.mocked(leadsApi.qualifyLeadAi).mockRejectedValue(
      new ApiError('AI qualification is not configured. Add an AI provider API key to enable this feature.', 422)
    );

    const user = userEvent.setup();
    renderPage();
    await screen.findByText(/no ai qualification available yet/i);

    await user.click(screen.getByRole('button', { name: /qualify lead with ai/i }));

    expect(await screen.findByText(/ai qualification is not configured/i)).toBeInTheDocument();
    expect(screen.getByText('AI Test Lead')).toBeInTheDocument();
  });
});
