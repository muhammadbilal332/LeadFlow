import { query } from '../db/pool';

export interface QuotationRow {
  id: string;
  business_id: string;
  lead_id: string;
  created_by: string | null;
  title: string;
  amount: string;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export async function createQuotation(input: {
  businessId: string;
  leadId: string;
  createdBy?: string | null;
  title: string;
  amount: number;
  status: string;
  notes?: string | null;
}): Promise<QuotationRow> {
  const result = await query<QuotationRow>(
    `INSERT INTO quotations (business_id, lead_id, created_by, title, amount, status, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [input.businessId, input.leadId, input.createdBy ?? null, input.title, input.amount, input.status, input.notes ?? null]
  );
  return result.rows[0];
}

export async function listQuotationsForLead(leadId: string, businessId: string): Promise<QuotationRow[]> {
  const result = await query<QuotationRow>(
    `SELECT * FROM quotations WHERE lead_id = $1 AND business_id = $2 ORDER BY created_at DESC`,
    [leadId, businessId]
  );
  return result.rows;
}

export async function findQuotationById(id: string, businessId: string): Promise<QuotationRow | null> {
  const result = await query<QuotationRow>(`SELECT * FROM quotations WHERE id = $1 AND business_id = $2`, [id, businessId]);
  return result.rows[0] ?? null;
}

export async function updateQuotation(
  id: string,
  businessId: string,
  input: Partial<{ title: string; amount: number; status: string; notes: string | null }>
): Promise<QuotationRow | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) {
      fields.push(`${key} = $${idx++}`);
      values.push(value);
    }
  }

  if (fields.length === 0) {
    return findQuotationById(id, businessId);
  }

  values.push(id, businessId);
  const result = await query<QuotationRow>(
    `UPDATE quotations SET ${fields.join(', ')} WHERE id = $${idx++} AND business_id = $${idx} RETURNING *`,
    values
  );
  return result.rows[0] ?? null;
}
