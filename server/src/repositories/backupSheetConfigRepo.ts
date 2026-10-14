import { query } from '../db/pool';

export interface BackupSheetConfig {
  spreadsheet_url: string | null;
  updated_by_user_id: string | null;
  updated_at: string;
}

export async function getBackupSheetConfig(): Promise<BackupSheetConfig | null> {
  const result = await query<BackupSheetConfig>(`SELECT spreadsheet_url, updated_by_user_id, updated_at FROM backup_sheet_config WHERE id = true`);
  return result.rows[0] ?? null;
}

export async function upsertBackupSheetConfig(spreadsheetUrl: string | null, updatedByUserId: string): Promise<BackupSheetConfig> {
  const result = await query<BackupSheetConfig>(
    `INSERT INTO backup_sheet_config (id, spreadsheet_url, updated_by_user_id, updated_at)
     VALUES (true, $1, $2, now())
     ON CONFLICT (id) DO UPDATE SET spreadsheet_url = $1, updated_by_user_id = $2, updated_at = now()
     RETURNING spreadsheet_url, updated_by_user_id, updated_at`,
    [spreadsheetUrl, updatedByUserId]
  );
  return result.rows[0];
}
