import { Lead, Business, AiQualification } from '../types';

export function sampleLead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: 'lead-1', business_id: 'biz-1', assigned_user_id: null, assigned_user_name: null,
    name: 'Sample Lead', company: null, email: null, phone: null, source: 'Website',
    industry: null, interested_in: null, budget: null, timeline: null, description: null,
    status: 'New', score: 0, priority: 'Low', created_at: '', updated_at: '',
    source_detail: null, form_id: null, campaign_id: null, campaign: null, ad_set: null, ad: null,
    utm_source: null, utm_medium: null, utm_campaign: null, utm_term: null, utm_content: null,
    landing_page: null, referrer: null, external_source: null,
    duplicate_of_lead_id: null, merged_at: null,
    first_contact_at: null, response_time_seconds: null, sla_due_at: null,
    sla_status: 'Pending', sla_state: 'Pending',
    ...overrides,
  };
}

export function sampleBusiness(overrides: Partial<Business> = {}): Business {
  return {
    id: 'biz-1', name: 'Test Biz', email: null, phone: null, industry: null,
    slug: 'test-biz', created_at: '', updated_at: '',
    ...overrides,
  };
}

export function sampleAiQualification(overrides: Partial<AiQualification> = {}): AiQualification {
  return {
    id: 'ai-1', lead_id: 'lead-1', score: 50, qualification: 'Warm',
    summary: '', reasoning: '', recommended_action: '',
    strengths: null, concerns: null, urgency: null, suggested_response: null, estimated_priority: null,
    created_at: '',
    ...overrides,
  };
}
