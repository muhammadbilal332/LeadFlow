import { query, withTransaction } from '../db/pool';

export interface LeadFormRow {
  id: string;
  business_id: string;
  name: string;
  slug: string;
  description: string | null;
  status: 'Active' | 'Disabled';
  thank_you_message: string;
  created_at: string;
  updated_at: string;
}

export interface LeadFormFieldRow {
  id: string;
  form_id: string;
  name: string;
  label: string;
  type: string;
  required: boolean;
  placeholder: string | null;
  options: string[] | null;
  sort_order: number;
  created_at: string;
}

export interface FieldInput {
  name: string;
  label: string;
  type: string;
  required?: boolean;
  placeholder?: string | null;
  options?: string[] | null;
  sortOrder?: number;
}

export async function listForms(businessId: string): Promise<LeadFormRow[]> {
  const result = await query<LeadFormRow>(`SELECT * FROM lead_forms WHERE business_id = $1 ORDER BY created_at DESC`, [businessId]);
  return result.rows;
}

export async function findFormById(id: string, businessId: string): Promise<LeadFormRow | null> {
  const result = await query<LeadFormRow>(`SELECT * FROM lead_forms WHERE id = $1 AND business_id = $2`, [id, businessId]);
  return result.rows[0] ?? null;
}

export async function findPublicForm(businessSlug: string, formSlug: string): Promise<{ form: LeadFormRow; businessId: string; businessName: string } | null> {
  const result = await query<LeadFormRow & { business_id_2: string; business_name: string }>(
    `SELECT f.*, b.id AS business_id_2, b.name AS business_name
     FROM lead_forms f
     JOIN businesses b ON b.id = f.business_id
     WHERE b.slug = $1 AND f.slug = $2 AND f.status = 'Active'`,
    [businessSlug, formSlug]
  );
  const row = result.rows[0];
  if (!row) return null;
  return { form: row, businessId: row.business_id, businessName: row.business_name };
}

export async function listFields(formId: string): Promise<LeadFormFieldRow[]> {
  const result = await query<LeadFormFieldRow>(`SELECT * FROM lead_form_fields WHERE form_id = $1 ORDER BY sort_order ASC`, [formId]);
  return result.rows;
}

export async function createForm(input: {
  businessId: string;
  name: string;
  slug: string;
  description?: string | null;
  thankYouMessage?: string;
  fields: FieldInput[];
}): Promise<LeadFormRow> {
  return withTransaction(async (client) => {
    const formResult = await client.query<LeadFormRow>(
      `INSERT INTO lead_forms (business_id, name, slug, description, thank_you_message)
       VALUES ($1, $2, $3, $4, COALESCE($5, 'Thanks! We will be in touch shortly.')) RETURNING *`,
      [input.businessId, input.name, input.slug, input.description ?? null, input.thankYouMessage ?? null]
    );
    const form = formResult.rows[0];

    for (let i = 0; i < input.fields.length; i++) {
      const f = input.fields[i];
      await client.query(
        `INSERT INTO lead_form_fields (form_id, name, label, type, required, placeholder, options, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [form.id, f.name, f.label, f.type, f.required ?? false, f.placeholder ?? null, f.options ? JSON.stringify(f.options) : null, f.sortOrder ?? i]
      );
    }

    return form;
  });
}

export async function updateForm(
  id: string,
  businessId: string,
  input: Partial<{ name: string; description: string | null; thankYouMessage: string; status: 'Active' | 'Disabled' }>
): Promise<LeadFormRow | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (input.name !== undefined) {
    fields.push(`name = $${idx++}`);
    values.push(input.name);
  }
  if (input.description !== undefined) {
    fields.push(`description = $${idx++}`);
    values.push(input.description);
  }
  if (input.thankYouMessage !== undefined) {
    fields.push(`thank_you_message = $${idx++}`);
    values.push(input.thankYouMessage);
  }
  if (input.status !== undefined) {
    fields.push(`status = $${idx++}`);
    values.push(input.status);
  }

  if (fields.length === 0) {
    return findFormById(id, businessId);
  }

  values.push(id, businessId);
  const result = await query<LeadFormRow>(
    `UPDATE lead_forms SET ${fields.join(', ')} WHERE id = $${idx++} AND business_id = $${idx} RETURNING *`,
    values
  );
  return result.rows[0] ?? null;
}

/** Replaces the full field list for a form (simplest reliable update strategy for a small field editor). */
export async function replaceFields(formId: string, fields: FieldInput[]): Promise<LeadFormFieldRow[]> {
  return withTransaction(async (client) => {
    await client.query(`DELETE FROM lead_form_fields WHERE form_id = $1`, [formId]);
    const rows: LeadFormFieldRow[] = [];
    for (let i = 0; i < fields.length; i++) {
      const f = fields[i];
      const result = await client.query<LeadFormFieldRow>(
        `INSERT INTO lead_form_fields (form_id, name, label, type, required, placeholder, options, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [formId, f.name, f.label, f.type, f.required ?? false, f.placeholder ?? null, f.options ? JSON.stringify(f.options) : null, f.sortOrder ?? i]
      );
      rows.push(result.rows[0]);
    }
    return rows;
  });
}

export async function deleteForm(id: string, businessId: string): Promise<boolean> {
  const result = await query(`DELETE FROM lead_forms WHERE id = $1 AND business_id = $2`, [id, businessId]);
  return (result.rowCount ?? 0) > 0;
}

export async function slugTaken(businessId: string, slug: string): Promise<boolean> {
  const result = await query(`SELECT 1 FROM lead_forms WHERE business_id = $1 AND slug = $2`, [businessId, slug]);
  return (result.rowCount ?? 0) > 0;
}
