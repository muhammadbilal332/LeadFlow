import { query } from '../db/pool';

export interface OutreachContactRow {
  id: string;
  business_id: string;
  sheet_import_id: string | null;
  lead_id: string | null;
  company_name: string | null;
  brand_name: string | null;
  contact_name: string | null;
  email: string;
  normalized_email: string;
  website: string | null;
  industry: string | null;
  location: string | null;
  pain_points: string | null;
  possible_solution: string | null;
  notes: string | null;
  custom_context: Record<string, unknown>;
  source: string;
  status: 'active' | 'suppressed' | 'unsubscribed' | 'bounced' | 'do_not_contact';
  created_at: string;
  updated_at: string;
}

export interface UpsertContactInput {
  businessId: string;
  sheetImportId?: string | null;
  companyName?: string | null;
  brandName?: string | null;
  contactName?: string | null;
  email: string;
  normalizedEmail: string;
  website?: string | null;
  industry?: string | null;
  location?: string | null;
  painPoints?: string | null;
  possibleSolution?: string | null;
  notes?: string | null;
  source?: string;
}

export async function findByNormalizedEmail(businessId: string, normalizedEmail: string): Promise<OutreachContactRow | null> {
  const result = await query<OutreachContactRow>(
    `SELECT * FROM outreach_contacts WHERE business_id = $1 AND normalized_email = $2`,
    [businessId, normalizedEmail]
  );
  return result.rows[0] ?? null;
}

export async function findById(id: string, businessId: string): Promise<OutreachContactRow | null> {
  const result = await query<OutreachContactRow>(`SELECT * FROM outreach_contacts WHERE id = $1 AND business_id = $2`, [id, businessId]);
  return result.rows[0] ?? null;
}

/** Creates the contact, or updates the enrichable fields on an existing one — never creates a duplicate for the same email within a business. */
export async function upsertContact(input: UpsertContactInput): Promise<{ contact: OutreachContactRow; created: boolean }> {
  const existing = await findByNormalizedEmail(input.businessId, input.normalizedEmail);
  if (existing) {
    const result = await query<OutreachContactRow>(
      `UPDATE outreach_contacts SET
         company_name = COALESCE($1, company_name),
         brand_name = COALESCE($2, brand_name),
         contact_name = COALESCE($3, contact_name),
         website = COALESCE($4, website),
         industry = COALESCE($5, industry),
         location = COALESCE($6, location),
         pain_points = COALESCE($7, pain_points),
         possible_solution = COALESCE($8, possible_solution),
         notes = COALESCE($9, notes),
         sheet_import_id = COALESCE($10, sheet_import_id),
         updated_at = now()
       WHERE id = $11
       RETURNING *`,
      [
        input.companyName ?? null,
        input.brandName ?? null,
        input.contactName ?? null,
        input.website ?? null,
        input.industry ?? null,
        input.location ?? null,
        input.painPoints ?? null,
        input.possibleSolution ?? null,
        input.notes ?? null,
        input.sheetImportId ?? null,
        existing.id,
      ]
    );
    return { contact: result.rows[0], created: false };
  }

  const result = await query<OutreachContactRow>(
    `INSERT INTO outreach_contacts
       (business_id, sheet_import_id, company_name, brand_name, contact_name, email, normalized_email, website, industry, location, pain_points, possible_solution, notes, source)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     RETURNING *`,
    [
      input.businessId,
      input.sheetImportId ?? null,
      input.companyName ?? null,
      input.brandName ?? null,
      input.contactName ?? null,
      input.email,
      input.normalizedEmail,
      input.website ?? null,
      input.industry ?? null,
      input.location ?? null,
      input.painPoints ?? null,
      input.possibleSolution ?? null,
      input.notes ?? null,
      input.source ?? 'manual',
    ]
  );
  return { contact: result.rows[0], created: true };
}

export async function listContacts(businessId: string, opts: { search?: string; status?: string; limit?: number; offset?: number } = {}): Promise<{ contacts: OutreachContactRow[]; total: number }> {
  const conditions = ['business_id = $1'];
  const params: unknown[] = [businessId];

  if (opts.status) {
    params.push(opts.status);
    conditions.push(`status = $${params.length}`);
  }
  if (opts.search) {
    params.push(`%${opts.search.toLowerCase()}%`);
    conditions.push(`(LOWER(contact_name) LIKE $${params.length} OR LOWER(company_name) LIKE $${params.length} OR LOWER(email) LIKE $${params.length})`);
  }

  const whereClause = conditions.join(' AND ');
  const countResult = await query<{ count: string }>(`SELECT COUNT(*)::text as count FROM outreach_contacts WHERE ${whereClause}`, params);

  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;
  params.push(limit, offset);
  const result = await query<OutreachContactRow>(
    `SELECT * FROM outreach_contacts WHERE ${whereClause} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return { contacts: result.rows, total: Number(countResult.rows[0]?.count ?? 0) };
}

export async function setStatus(id: string, businessId: string, status: OutreachContactRow['status']): Promise<OutreachContactRow | null> {
  const result = await query<OutreachContactRow>(
    `UPDATE outreach_contacts SET status = $1, updated_at = now() WHERE id = $2 AND business_id = $3 RETURNING *`,
    [status, id, businessId]
  );
  return result.rows[0] ?? null;
}

export async function setStatusByEmail(businessId: string, normalizedEmail: string, status: OutreachContactRow['status']): Promise<void> {
  await query(`UPDATE outreach_contacts SET status = $1, updated_at = now() WHERE business_id = $2 AND normalized_email = $3`, [status, businessId, normalizedEmail]);
}

export async function linkToLead(id: string, businessId: string, leadId: string): Promise<void> {
  await query(`UPDATE outreach_contacts SET lead_id = $1, updated_at = now() WHERE id = $2 AND business_id = $3`, [leadId, id, businessId]);
}

/** Cascades to its campaign_contacts, drafts, messages, and email threads (ON DELETE CASCADE in the schema). */
export async function deleteContact(id: string, businessId: string): Promise<boolean> {
  const result = await query(`DELETE FROM outreach_contacts WHERE id = $1 AND business_id = $2`, [id, businessId]);
  return (result.rowCount ?? 0) > 0;
}
