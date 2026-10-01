import { apiRequest } from '../lib/api';
import { LeadForm, LeadFormField } from '../types';

export function listForms(): Promise<{ forms: LeadForm[] }> {
  return apiRequest('/forms');
}

export function getForm(id: string): Promise<{ form: LeadForm }> {
  return apiRequest(`/forms/${id}`);
}

export interface FormInput {
  name: string;
  slug?: string;
  description?: string | null;
  thankYouMessage?: string;
  fields: LeadFormField[];
}

export function createForm(input: FormInput): Promise<{ form: LeadForm }> {
  return apiRequest('/forms', { method: 'POST', body: input });
}

export function updateForm(id: string, input: Partial<FormInput & { status: 'Active' | 'Disabled' }>): Promise<{ form: LeadForm }> {
  return apiRequest(`/forms/${id}`, { method: 'PATCH', body: input });
}

export function deleteForm(id: string): Promise<void> {
  return apiRequest(`/forms/${id}`, { method: 'DELETE' });
}

export function getEmbedInfo(id: string): Promise<{ publicUrl: string; embedCode: string }> {
  return apiRequest(`/forms/${id}/embed`);
}

// ===========================================================
// Public (unauthenticated)
// ===========================================================
export function getPublicForm(businessSlug: string, formSlug: string): Promise<{ form: { id: string; name: string; description: string | null; fields: LeadFormField[] }; businessName: string }> {
  return apiRequest(`/public/forms/${businessSlug}/${formSlug}`);
}

export interface PublicSubmission {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  message?: string;
  fields: Record<string, string | number>;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  landingPage?: string;
  referrer?: string;
}

export function submitPublicForm(businessSlug: string, formSlug: string, input: PublicSubmission): Promise<{ success: boolean; thankYouMessage: string }> {
  return apiRequest(`/public/forms/${businessSlug}/${formSlug}/submit`, { method: 'POST', body: input });
}
