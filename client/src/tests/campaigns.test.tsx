import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CampaignsPage from '../pages/CampaignsPage';
import * as campaignsApi from '../services/campaignsApi';

vi.mock('../services/campaignsApi');

describe('CampaignsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows an empty state with no campaign data', async () => {
    vi.mocked(campaignsApi.listCampaigns).mockResolvedValue({ campaigns: [] });

    render(
      <MemoryRouter>
        <CampaignsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/no campaigns yet/i)).toBeInTheDocument();
  });

  it('renders campaign performance rows with computed conversion', async () => {
    vi.mocked(campaignsApi.listCampaigns).mockResolvedValue({
      campaigns: [
        { id: 'c1', name: 'Fall Sale', source: 'Instagram', utm_campaign: 'fall-sale', total_leads: 10, qualified: 4, won: 2, revenue: 5000 },
      ],
    });

    render(
      <MemoryRouter>
        <CampaignsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('Fall Sale')).toBeInTheDocument();
    expect(screen.getByText('20%')).toBeInTheDocument();
  });
});
