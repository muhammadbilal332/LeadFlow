import { query } from '../db/pool';

export interface EmailSettingsRow {
  business_id: string;
  default_sender_name: string | null;
  default_sender_email: string | null;
  default_reply_to: string | null;
  daily_send_limit: number;
  voice_description: string | null;
  updated_at: string;
}

export async function getSettings(businessId: string): Promise<EmailSettingsRow | null> {
  const result = await query<EmailSettingsRow>(`SELECT * FROM email_settings WHERE business_id = $1`, [businessId]);
  return result.rows[0] ?? null;
}

export async function upsertSettings(input: {
  businessId: string;
  defaultSenderName?: string | null;
  defaultSenderEmail?: string | null;
  defaultReplyTo?: string | null;
  dailySendLimit?: number;
  voiceDescription?: string | null;
}): Promise<EmailSettingsRow> {
  const existing = await getSettings(input.businessId);
  if (existing) {
    const result = await query<EmailSettingsRow>(
      `UPDATE email_settings SET
         default_sender_name = COALESCE($1, default_sender_name),
         default_sender_email = COALESCE($2, default_sender_email),
         default_reply_to = COALESCE($3, default_reply_to),
         daily_send_limit = COALESCE($4, daily_send_limit),
         voice_description = COALESCE($5, voice_description),
         updated_at = now()
       WHERE business_id = $6 RETURNING *`,
      [input.defaultSenderName ?? null, input.defaultSenderEmail ?? null, input.defaultReplyTo ?? null, input.dailySendLimit ?? null, input.voiceDescription ?? null, input.businessId]
    );
    return result.rows[0];
  }
  const result = await query<EmailSettingsRow>(
    `INSERT INTO email_settings (business_id, default_sender_name, default_sender_email, default_reply_to, daily_send_limit, voice_description)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [input.businessId, input.defaultSenderName ?? null, input.defaultSenderEmail ?? null, input.defaultReplyTo ?? null, input.dailySendLimit ?? 100, input.voiceDescription ?? null]
  );
  return result.rows[0];
}
