import { query } from '../db/pool';

export interface UserRow {
  id: string;
  business_id: string;
  name: string;
  email: string;
  password_hash: string;
  role: 'owner' | 'sales' | 'developer';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type SafeUser = Omit<UserRow, 'password_hash'>;

const SAFE_COLUMNS = 'id, business_id, name, email, role, is_active, created_at, updated_at';

export async function createUser(input: {
  businessId: string;
  name: string;
  email: string;
  passwordHash: string;
  role: 'owner' | 'sales' | 'developer';
}): Promise<UserRow> {
  const result = await query<UserRow>(
    `INSERT INTO users (business_id, name, email, password_hash, role) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [input.businessId, input.name, input.email, input.passwordHash, input.role]
  );
  return result.rows[0];
}

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const result = await query<UserRow>(`SELECT * FROM users WHERE email = $1`, [email]);
  return result.rows[0] ?? null;
}

export async function findUserById(id: string): Promise<UserRow | null> {
  const result = await query<UserRow>(`SELECT * FROM users WHERE id = $1`, [id]);
  return result.rows[0] ?? null;
}

export async function findOwnerByBusiness(businessId: string): Promise<SafeUser | null> {
  const result = await query<SafeUser>(
    `SELECT ${SAFE_COLUMNS} FROM users WHERE business_id = $1 AND role = 'owner' ORDER BY created_at ASC LIMIT 1`,
    [businessId]
  );
  return result.rows[0] ?? null;
}

export async function listActiveSalesUsers(businessId: string): Promise<SafeUser[]> {
  const result = await query<SafeUser>(
    `SELECT ${SAFE_COLUMNS} FROM users WHERE business_id = $1 AND is_active = true ORDER BY created_at ASC`,
    [businessId]
  );
  return result.rows;
}

export async function findSafeUserById(id: string, businessId: string): Promise<SafeUser | null> {
  const result = await query<SafeUser>(
    `SELECT ${SAFE_COLUMNS} FROM users WHERE id = $1 AND business_id = $2`,
    [id, businessId]
  );
  return result.rows[0] ?? null;
}

export async function listUsersByBusiness(businessId: string): Promise<SafeUser[]> {
  const result = await query<SafeUser>(
    `SELECT ${SAFE_COLUMNS} FROM users WHERE business_id = $1 ORDER BY created_at ASC`,
    [businessId]
  );
  return result.rows;
}

/** Developer-only: changes a user's role directly, bypassing the normal per-business user-management path (which never exposes role changes). */
export async function updateUserRole(id: string, role: 'owner' | 'sales'): Promise<SafeUser | null> {
  const result = await query<SafeUser>(`UPDATE users SET role = $1, updated_at = now() WHERE id = $2 RETURNING ${SAFE_COLUMNS}`, [role, id]);
  return result.rows[0] ?? null;
}

export async function updateUser(
  id: string,
  businessId: string,
  input: Partial<{ name: string; isActive: boolean }>
): Promise<SafeUser | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (input.name !== undefined) {
    fields.push(`name = $${idx++}`);
    values.push(input.name);
  }
  if (input.isActive !== undefined) {
    fields.push(`is_active = $${idx++}`);
    values.push(input.isActive);
  }

  if (fields.length === 0) {
    return findSafeUserById(id, businessId);
  }

  values.push(id, businessId);
  const result = await query<SafeUser>(
    `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx++} AND business_id = $${idx} RETURNING ${SAFE_COLUMNS}`,
    values
  );
  return result.rows[0] ?? null;
}
