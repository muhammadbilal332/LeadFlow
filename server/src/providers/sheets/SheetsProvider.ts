export interface SheetConnectionConfig {
  spreadsheetId: string | null;
  sheetRange: string;
}

/** A raw row of header->value strings, exactly as the sheet has it — no interpretation yet. */
export type RawSheetRow = Record<string, string>;

export interface SheetsProvider {
  name: string;
  isConfigured(): boolean;
  fetchRows(config: SheetConnectionConfig): Promise<RawSheetRow[]>;
}
