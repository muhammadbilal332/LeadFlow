/**
 * Imports contacts from the active SheetsProvider (mock by default — a
 * fixed realistic dataset; Google Sheets when configured). Every row is
 * validated, deduped against existing contacts by normalized email
 * (upsert, never a duplicate row), and the whole run is recorded as a
 * sheet_imports entry with per-row error detail.
 */
import { getSheetsProvider } from '../../providers/sheets';
import { RawSheetRow } from '../../providers/sheets/SheetsProvider';
import * as sheetRepo from '../../repositories/sheetRepo';
import * as outreachContactRepo from '../../repositories/outreachContactRepo';
import { normalizeEmail } from '../../utils/normalize';
import { SheetConnectionRow, SheetImportRow } from '../../repositories/sheetRepo';
import { intakeLead } from '../leadIntakeService';

const DEFAULT_COLUMN_MAPPING: Record<string, string> = {
  company_name: 'company_name',
  brand_name: 'brand_name',
  contact_name: 'contact_name',
  email: 'email',
  website: 'website',
  industry: 'industry',
  location: 'location',
  pain_points: 'pain_points',
  possible_solution: 'possible_solution',
  notes: 'notes',
};

function mapRow(raw: RawSheetRow, mapping: Record<string, string>): Record<string, string> {
  const mapped: Record<string, string> = {};
  for (const [field, sourceColumn] of Object.entries({ ...DEFAULT_COLUMN_MAPPING, ...mapping })) {
    const value = raw[sourceColumn] ?? raw[sourceColumn?.toLowerCase()] ?? '';
    if (value) mapped[field] = value.trim();
  }
  return mapped;
}

export interface RunImportResult {
  importRow: SheetImportRow;
  /** Every contact touched by this run (newly created or matched-and-updated) — lets a caller immediately act on exactly what this import brought in, e.g. add it all to a campaign. */
  contactIds: string[];
}

export async function runImport(businessId: string, connection: SheetConnectionRow | null, createdBy?: string | null): Promise<RunImportResult> {
  const provider = getSheetsProvider();
  if (!provider.isConfigured()) {
    throw new Error(`Sheets provider "${provider.name}" is not configured`);
  }

  const rawRows = await provider.fetchRows({
    spreadsheetId: connection?.spreadsheet_id ?? null,
    sheetRange: connection?.sheet_range ?? 'Sheet1',
  });

  let imported = 0;
  let duplicates = 0;
  let failedCount = 0;
  const errors: Array<{ row: number; message: string }> = [];
  const contactIds: string[] = [];

  for (let i = 0; i < rawRows.length; i++) {
    const mapped = mapRow(rawRows[i], connection?.column_mapping ?? {});
    const email = mapped.email;
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail) {
      failedCount += 1;
      errors.push({ row: i + 1, message: 'Missing or invalid email address' });
      continue;
    }

    const { contact, created } = await outreachContactRepo.upsertContact({
      businessId,
      sheetImportId: undefined,
      companyName: mapped.company_name ?? null,
      brandName: mapped.brand_name ?? null,
      contactName: mapped.contact_name ?? null,
      email,
      normalizedEmail,
      website: mapped.website ?? null,
      industry: mapped.industry ?? null,
      location: mapped.location ?? null,
      painPoints: mapped.pain_points ?? null,
      possibleSolution: mapped.possible_solution ?? null,
      notes: mapped.notes ?? null,
      source: connection ? 'sheet' : 'sheet',
    });

    contactIds.push(contact.id);
    if (created) imported += 1;
    else duplicates += 1;

    // Every sheet-imported contact also becomes a real CRM lead, not just an
    // outreach contact — this is how the CRM's Leads/Inbox/Pipeline actually
    // see the sheet's real data instead of only the separate Outreach
    // section. Idempotent via externalSource+externalId (also enforced by a
    // unique DB index): re-running the import for a row whose contact
    // already produced a lead just returns that lead rather than creating a
    // duplicate, so this is safe to call on every row of every run, not
    // just newly-created contacts — it also backfills a lead for a contact
    // that was imported before this existed.
    try {
      const { lead } = await intakeLead({
        businessId,
        name: mapped.contact_name || mapped.company_name || email,
        email,
        company: mapped.company_name ?? null,
        source: 'GoogleSheet',
        industry: mapped.industry ?? null,
        interestedIn: mapped.possible_solution ?? null,
        description: [mapped.pain_points, mapped.notes].filter(Boolean).join('\n\n') || null,
        externalSource: 'google_sheet',
        externalId: contact.id,
        actorUserId: createdBy ?? null,
        skipAutomation: true,
      });
      if (!contact.lead_id) {
        await outreachContactRepo.linkToLead(contact.id, businessId, lead.id);
      }
    } catch (err) {
      console.error(`sheetsImportService: failed to create a CRM lead for contact ${contact.id}:`, err instanceof Error ? err.message : err);
    }
  }

  if (connection) await sheetRepo.markSynced(connection.id);

  const importRow = await sheetRepo.createImport({
    businessId,
    connectionId: connection?.id ?? null,
    sourceType: 'sheet',
    totalRows: rawRows.length,
    importedRows: imported,
    duplicateRows: duplicates,
    failedRows: failedCount,
    errors,
    createdBy,
  });

  return { importRow, contactIds };
}
