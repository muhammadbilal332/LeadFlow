import { query } from '../db/pool';

export interface SheetConnectionRow {
  id: string;
  business_id: string;
  name: string;
  provider: string;
  spreadsheet_id: string | null;
  sheet_range: string;
  column_mapping: Record<string, string>;
  status: 'Active' | 'Disabled';
  last_synced_at: string | null;
  default_campaign_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface SheetImportRow {
  id: string;
  business_id: string;
  connection_id: string | null;
  source_type: 'sheet' | 'csv' | 'manual';
  status: 'Running' | 'Completed' | 'Failed';
  total_rows: number;
  imported_rows: number;
  duplicate_rows: number;
  failed_rows: number;
  errors: Array<{ row: number; message: string }>;
  created_by: string | null;
  created_at: string;
}

export async function findConnectionByBusiness(businessId: string): Promise<SheetConnectionRow | null> {
  const result = await query<SheetConnectionRow>(`SELECT * FROM sheet_connections WHERE business_id = $1 ORDER BY created_at DESC LIMIT 1`, [businessId]);
  return result.rows[0] ?? null;
}

export async function upsertConnection(input: {
  businessId: string;
  name: string;
  provider: string;
  spreadsheetId?: string | null;
  sheetRange?: string;
  columnMapping?: Record<string, string>;
}): Promise<SheetConnectionRow> {
  const existing = await findConnectionByBusiness(input.businessId);
  if (existing) {
    const result = await query<SheetConnectionRow>(
      `UPDATE sheet_connections SET name = $1, provider = $2, spreadsheet_id = $3, sheet_range = $4, column_mapping = $5, status = 'Active', updated_at = now()
       WHERE id = $6 RETURNING *`,
      [input.name, input.provider, input.spreadsheetId ?? null, input.sheetRange ?? 'Sheet1', JSON.stringify(input.columnMapping ?? {}), existing.id]
    );
    return result.rows[0];
  }
  const result = await query<SheetConnectionRow>(
    `INSERT INTO sheet_connections (business_id, name, provider, spreadsheet_id, sheet_range, column_mapping)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [input.businessId, input.name, input.provider, input.spreadsheetId ?? null, input.sheetRange ?? 'Sheet1', JSON.stringify(input.columnMapping ?? {})]
  );
  return result.rows[0];
}

export async function markSynced(id: string): Promise<void> {
  await query(`UPDATE sheet_connections SET last_synced_at = now(), updated_at = now() WHERE id = $1`, [id]);
}

/** Remembers which auto-pilot campaign this connection's imports feed into, so repeated imports keep landing in the same campaign. */
export async function setDefaultCampaign(connectionId: string, campaignId: string): Promise<void> {
  await query(`UPDATE sheet_connections SET default_campaign_id = $1, updated_at = now() WHERE id = $2`, [campaignId, connectionId]);
}

export async function disableConnection(businessId: string): Promise<void> {
  await query(`UPDATE sheet_connections SET status = 'Disabled', updated_at = now() WHERE business_id = $1`, [businessId]);
}

export async function createImport(input: {
  businessId: string;
  connectionId?: string | null;
  sourceType: 'sheet' | 'csv' | 'manual';
  totalRows: number;
  importedRows: number;
  duplicateRows: number;
  failedRows: number;
  errors: Array<{ row: number; message: string }>;
  createdBy?: string | null;
}): Promise<SheetImportRow> {
  const result = await query<SheetImportRow>(
    `INSERT INTO sheet_imports (business_id, connection_id, source_type, status, total_rows, imported_rows, duplicate_rows, failed_rows, errors, created_by)
     VALUES ($1,$2,$3,'Completed',$4,$5,$6,$7,$8,$9) RETURNING *`,
    [
      input.businessId,
      input.connectionId ?? null,
      input.sourceType,
      input.totalRows,
      input.importedRows,
      input.duplicateRows,
      input.failedRows,
      JSON.stringify(input.errors),
      input.createdBy ?? null,
    ]
  );
  return result.rows[0];
}

export async function listImports(businessId: string, limit = 25): Promise<SheetImportRow[]> {
  const result = await query<SheetImportRow>(`SELECT * FROM sheet_imports WHERE business_id = $1 ORDER BY created_at DESC LIMIT $2`, [businessId, limit]);
  return result.rows;
}
