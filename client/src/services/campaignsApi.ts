import { apiRequest } from '../lib/api';
import { Campaign, Lead } from '../types';

export function listCampaigns(): Promise<{ campaigns: Campaign[] }> {
  return apiRequest('/campaigns');
}

export function getCampaign(id: string): Promise<{ campaign: { id: string; name: string; source: string | null; utm_campaign: string | null }; leads: Lead[]; totalLeads: number }> {
  return apiRequest(`/campaigns/${id}`);
}
