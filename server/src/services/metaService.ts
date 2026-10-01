/**
 * Meta (Facebook/Instagram) Lead Ads webhook integration.
 *
 * Meta's leadgen webhook event only carries IDs (leadgen_id, page_id,
 * form_id, ad_id) — the actual submitted field data (name/email/phone) has
 * to be fetched separately from the Graph API using a Page Access Token
 * for that page. Without real Meta app credentials and a real page token,
 * this service cannot produce a live lead with genuine data, and it will
 * not invent one. What IS fully implemented and testable without any
 * external credentials:
 *   - the GET webhook-verification handshake
 *   - X-Hub-Signature-256 verification of inbound POST payloads
 *   - parsing entry[].changes[].value into a normalized event
 *   - the Graph API call that fetches lead field data, ready to run the
 *     moment a real page access token is configured
 */
import { createHmac, timingSafeEqual } from 'crypto';
import { env } from '../config/env';

export interface MetaLeadgenEvent {
  pageId: string;
  formId: string;
  leadgenId: string;
  adId: string | null;
  adgroupId: string | null;
  createdTime: number | null;
}

export function verifyWebhookChallenge(mode: string | undefined, token: string | undefined): boolean {
  return mode === 'subscribe' && Boolean(env.META_VERIFY_TOKEN) && token === env.META_VERIFY_TOKEN;
}

/** Verifies Meta's X-Hub-Signature-256 header against the raw request body using META_APP_SECRET. */
export function verifySignature(rawBody: Buffer, signatureHeader: string | undefined): boolean {
  if (!env.META_APP_SECRET || !signatureHeader) return false;
  const expected = 'sha256=' + createHmac('sha256', env.META_APP_SECRET).update(rawBody).digest('hex');

  const a = Buffer.from(signatureHeader);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

interface MetaWebhookPayload {
  object?: string;
  entry?: Array<{
    id?: string;
    time?: number;
    changes?: Array<{
      field?: string;
      value?: {
        leadgen_id?: string;
        page_id?: string;
        form_id?: string;
        ad_id?: string;
        adgroup_id?: string;
        created_time?: number;
      };
    }>;
  }>;
}

export function parseLeadgenEvents(payload: unknown): MetaLeadgenEvent[] {
  const body = payload as MetaWebhookPayload;
  const events: MetaLeadgenEvent[] = [];

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== 'leadgen' || !change.value?.leadgen_id) continue;
      events.push({
        pageId: change.value.page_id ?? entry.id ?? '',
        formId: change.value.form_id ?? '',
        leadgenId: change.value.leadgen_id,
        adId: change.value.ad_id ?? null,
        adgroupId: change.value.adgroup_id ?? null,
        createdTime: change.value.created_time ?? entry.time ?? null,
      });
    }
  }

  return events;
}

export interface MetaLeadFieldData {
  name: string | null;
  email: string | null;
  phone: string | null;
}

/**
 * Fetches the submitted field data for a leadgen event from the Graph API.
 * Requires a real Page Access Token — throws if the call fails, so callers
 * can log the failure rather than fabricate lead data.
 */
export async function fetchLeadFieldData(leadgenId: string, pageAccessToken: string): Promise<MetaLeadFieldData> {
  const url = `https://graph.facebook.com/v19.0/${leadgenId}?access_token=${encodeURIComponent(pageAccessToken)}`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Meta Graph API request failed (${res.status}): ${body}`);
  }
  const data = (await res.json()) as { field_data?: Array<{ name: string; values: string[] }> };
  const fields = data.field_data ?? [];
  const get = (key: string) => fields.find((f) => f.name.toLowerCase() === key)?.values?.[0] ?? null;

  const fullName = [get('first_name'), get('last_name')].filter(Boolean).join(' ');
  return {
    name: get('full_name') ?? (fullName || null),
    email: get('email'),
    phone: get('phone_number'),
  };
}
