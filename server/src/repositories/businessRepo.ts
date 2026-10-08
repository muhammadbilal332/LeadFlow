import { query } from '../db/pool';
import { uniqueSlug } from '../utils/slug';

export interface Business {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  industry: string | null;
  slug: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export async function createBusiness(input: { name: string; email?: string | null; phone?: string | null; industry?: string | null }): Promise<Business> {
  const result = await query<Business>(
    `INSERT INTO businesses (name, email, phone, industry, slug) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [input.name, input.email ?? null, input.phone ?? null, input.industry ?? null, uniqueSlug(input.name)]
  );
  return result.rows[0];
}

export async function findBusinessById(id: string): Promise<Business | null> {
  const result = await query<Business>(`SELECT * FROM businesses WHERE id = $1`, [id]);
  return result.rows[0] ?? null;
}

export async function findBusinessBySlug(slug: string): Promise<Business | null> {
  const result = await query<Business>(`SELECT * FROM businesses WHERE slug = $1`, [slug]);
  return result.rows[0] ?? null;
}

export async function updateBusiness(
  id: string,
  input: Partial<{ name: string; email: string | null; phone: string | null; industry: string | null }>
): Promise<Business | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) {
      fields.push(`${key} = $${idx}`);
      values.push(value);
      idx++;
    }
  }

  if (fields.length === 0) {
    return findBusinessById(id);
  }

  values.push(id);
  const result = await query<Business>(
    `UPDATE businesses SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );
  return result.rows[0] ?? null;
}

