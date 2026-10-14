/**
 * The approved table/column allowlist for the Google Sheets business-data
 * export. This is the ONLY place that decides what leaves the database for
 * Sheets — every column here was chosen deliberately; see
 * docs/DATABASE_BACKUP_AND_RESTORE.md for the full reasoning and the list
 * of tables explicitly excluded and why.
 *
 * Deliberately excluded from every table: free-text fields that could hold
 * arbitrary customer/business detail (`description`, `notes`,
 * `pain_points`, `possible_solution`), marketing/attribution minutiae
 * (UTM params, ad tracking, landing pages), and anything from
 * authentication/permissions/secrets tables.
 */

export interface BusinessTableConfig {
  /** The Sheets tab name. */
  sheetTitle: string;
  /** The actual Postgres table in schema `public`. */
  table: string;
  /** Exact, deterministic column order — never `SELECT *`. */
  columns: string[];
  /** Stable sort for a reproducible snapshot across runs. */
  orderBy: string;
}

export const BUSINESS_TABLES: BusinessTableConfig[] = [
  {
    sheetTitle: 'Leads',
    table: 'leads',
    columns: [
      'id',
      'business_id',
      'assigned_user_id',
      'name',
      'company',
      'email',
      'phone',
      'source',
      'industry',
      'status',
      'score',
      'priority',
      'sla_status',
      'created_at',
      'updated_at',
    ],
    orderBy: 'created_at ASC',
  },
  {
    sheetTitle: 'Outreach Contacts',
    table: 'outreach_contacts',
    columns: ['id', 'business_id', 'lead_id', 'contact_name', 'company_name', 'email', 'industry', 'location', 'source', 'status', 'created_at', 'updated_at'],
    orderBy: 'created_at ASC',
  },
  {
    sheetTitle: 'Quotations',
    table: 'quotations',
    columns: ['id', 'business_id', 'lead_id', 'created_by', 'title', 'amount', 'status', 'created_at', 'updated_at'],
    orderBy: 'created_at ASC',
  },
];

export const BACKUP_LOG_SHEET = 'Backup Log';
export const EXPORT_RUNS_SHEET = 'Export Runs';

export const BACKUP_LOG_HEADER = [
  'timestamp_utc',
  'run_id',
  'run_attempt',
  'status',
  'object_key',
  'size_bytes',
  'sha256',
  'duration_seconds',
  'error_summary',
];

export const EXPORT_RUNS_HEADER = ['timestamp_utc', 'run_id', 'run_attempt', 'trigger', 'status', 'tables_exported', 'total_rows', 'duration_seconds', 'error_summary'];
