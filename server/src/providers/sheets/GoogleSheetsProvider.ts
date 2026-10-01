import { env } from '../../config/env';
import { RawSheetRow, SheetConnectionConfig, SheetsProvider } from './SheetsProvider';

/**
 * Real provider using the free Google Sheets API v4 `values.get` endpoint
 * with a simple API key — no OAuth flow, no payment, works against any
 * sheet shared as "Anyone with the link can view". This covers the common
 * case (a business maintains one shared prospect sheet) without requiring
 * the heavier OAuth consent flow. GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI are
 * reserved for a future private-sheet OAuth flow and are not wired up yet —
 * this provider only reads public/link-shared sheets via GOOGLE_API_KEY.
 */
export class GoogleSheetsProvider implements SheetsProvider {
  name = 'google';

  isConfigured(): boolean {
    return Boolean(env.GOOGLE_API_KEY);
  }

  async fetchRows(config: SheetConnectionConfig): Promise<RawSheetRow[]> {
    if (!this.isConfigured()) {
      throw new Error('Google Sheets is not configured (missing GOOGLE_API_KEY)');
    }
    if (!config.spreadsheetId) {
      throw new Error('No spreadsheet is connected');
    }

    const range = encodeURIComponent(config.sheetRange || 'Sheet1');
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}/values/${range}?key=${env.GOOGLE_API_KEY}`;

    const res = await fetch(url);
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Google Sheets request failed (${res.status}): ${body}`);
    }

    const data = (await res.json()) as { values?: string[][] };
    const rows = data.values ?? [];
    if (rows.length < 2) return [];

    const headers = rows[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
    return rows.slice(1).map((row) => {
      const record: RawSheetRow = {};
      headers.forEach((header, i) => {
        record[header] = row[i] ?? '';
      });
      return record;
    });
  }
}
