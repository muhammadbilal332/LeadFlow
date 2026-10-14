/**
 * Minimal Google Sheets API v4 REST wrapper — only the handful of calls
 * this toolkit actually needs (get metadata, ensure a tab exists, read a
 * range, append rows, clear a range, overwrite a range). Every call goes
 * through `withRetry` so a transient 429/5xx is retried with bounded
 * exponential backoff; anything else (auth failure, bad request) surfaces
 * immediately.
 */
import { RetryableHttpError, isRetryableStatus, withRetry } from './retry.js';

const API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

export interface SheetInfo {
  sheetId: number;
  title: string;
  rowCount: number;
  columnCount: number;
}

export class SheetsClient {
  constructor(
    private readonly spreadsheetId: string,
    private readonly accessToken: string,
    private readonly fetchImpl: typeof fetch = fetch
  ) {}

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    return withRetry(async () => {
      const res = await this.fetchImpl(`${API_BASE}/${this.spreadsheetId}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
          ...(init.headers ?? {}),
        },
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        const message = `Sheets API ${init.method ?? 'GET'} ${path} -> HTTP ${res.status}: ${text.slice(0, 300)}`;
        if (isRetryableStatus(res.status)) throw new RetryableHttpError(res.status, message);
        throw new Error(message);
      }
      return res.json() as Promise<T>;
    });
  }

  async getSheets(): Promise<SheetInfo[]> {
    const data = await this.request<{ sheets: Array<{ properties: { sheetId: number; title: string; gridProperties?: { rowCount?: number; columnCount?: number } } }> }>('');
    return data.sheets.map((s) => ({
      sheetId: s.properties.sheetId,
      title: s.properties.title,
      rowCount: s.properties.gridProperties?.rowCount ?? 1000,
      columnCount: s.properties.gridProperties?.columnCount ?? 26,
    }));
  }

  async ensureSheetExists(title: string): Promise<void> {
    const sheets = await this.getSheets();
    if (sheets.some((s) => s.title === title)) return;
    await this.request(':batchUpdate', {
      method: 'POST',
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title } } }] }),
    });
  }

  /** Grows a tab's row/column count if the caller needs more room than it currently has — never shrinks it, never touches existing data. */
  async ensureCapacity(sheetId: number, title: string, minRows: number, minColumns: number): Promise<void> {
    const sheets = await this.getSheets();
    const current = sheets.find((s) => s.sheetId === sheetId);
    if (!current) throw new Error(`ensureCapacity: no sheet with id ${sheetId}`);
    const rowCount = Math.max(current.rowCount, minRows);
    const columnCount = Math.max(current.columnCount, minColumns);
    if (rowCount === current.rowCount && columnCount === current.columnCount) return;
    void title;
    await this.request(':batchUpdate', {
      method: 'POST',
      body: JSON.stringify({
        requests: [
          {
            updateSheetProperties: {
              properties: { sheetId, gridProperties: { rowCount, columnCount } },
              fields: 'gridProperties.rowCount,gridProperties.columnCount',
            },
          },
        ],
      }),
    });
  }

  async getValues(range: string): Promise<string[][]> {
    const data = await this.request<{ values?: string[][] }>(`/values/${encodeURIComponent(range)}`);
    return data.values ?? [];
  }

  /** Append-only — never overwrites existing rows. Used for Backup Log and Export Runs. */
  async appendRows(range: string, rows: string[][]): Promise<void> {
    if (rows.length === 0) return;
    await this.request(`/values/${encodeURIComponent(range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
      method: 'POST',
      body: JSON.stringify({ values: rows }),
    });
  }

  /** Overwrites exactly the given range — used only for business-data "current snapshot" tabs, never for the append-only log tabs. */
  async updateRange(range: string, rows: string[][]): Promise<void> {
    await this.request(`/values/${encodeURIComponent(range)}?valueInputOption=RAW`, {
      method: 'PUT',
      body: JSON.stringify({ values: rows }),
    });
  }

  async clearRange(range: string): Promise<void> {
    await this.request(`/values/${encodeURIComponent(range)}:clear`, { method: 'POST', body: JSON.stringify({}) });
  }
}
