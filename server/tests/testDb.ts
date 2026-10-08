import { newDb, DataType } from 'pg-mem';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { setPool } from '../src/db/pool';

const MIGRATIONS_DIR = path.resolve(__dirname, '../../database/migrations');

export async function setupTestDatabase(): Promise<void> {
  const db = newDb({ autoCreateForeignKeyIndices: true });

  db.public.registerFunction({
    name: 'gen_random_uuid',
    returns: DataType.uuid,
    implementation: () => randomUUID(),
    impure: true,
  });

  db.registerExtension('pgcrypto', (schema) => {
    schema.registerFunction({
      name: 'gen_random_uuid',
      returns: DataType.uuid,
      implementation: () => randomUUID(),
      impure: true,
    });
  });

  // pg-mem implements very few native functions; these two power the
  // dashboard's "leads over time" chart query. Real Postgres/Supabase
  // supports both natively.
  db.public.registerFunction({
    name: 'date_trunc',
    args: [DataType.text, DataType.timestamptz],
    returns: DataType.timestamptz,
    implementation: (unit: string, value: Date) => {
      const d = new Date(value);
      if (unit === 'day') d.setUTCHours(0, 0, 0, 0);
      return d;
    },
  });
  db.public.registerFunction({
    name: 'to_char',
    args: [DataType.timestamptz, DataType.text],
    returns: DataType.text,
    implementation: (value: Date) => new Date(value).toISOString().slice(0, 10),
  });

  // Used by the businesses.slug backfill in 002_lead_capture_forms.sql.
  // Real Postgres/Supabase supports both natively.
  db.public.registerFunction({
    name: 'replace',
    args: [DataType.text, DataType.text, DataType.text],
    returns: DataType.text,
    implementation: (value: string, search: string, replacement: string) => value.split(search).join(replacement),
  });
  db.public.registerFunction({
    name: 'left',
    args: [DataType.text, DataType.integer],
    returns: DataType.text,
    implementation: (value: string, n: number) => value.slice(0, n),
  });

  const pgAdapter = db.adapters.createPg();
  const pool = new pgAdapter.Pool();

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    let sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
    // pg-mem does not support triggers/plpgsql functions; they only matter for
    // auto-updating `updated_at`, which the app also sets explicitly where needed.
    const triggerSectionIndex = sql.indexOf('-- updated_at trigger helper');
    if (triggerSectionIndex !== -1) {
      sql = sql.slice(0, sql.lastIndexOf('-- ==', triggerSectionIndex));
    }

    // pg-mem's ALTER TABLE ... DROP CONSTRAINT does not actually remove an
    // inline CHECK constraint from a CREATE TABLE (confirmed pg-mem bug) —
    // it just adds the new one alongside the old, so both are enforced and
    // the widened `source` list in 004_lead_attribution.sql would always
    // fail. Real Postgres/Supabase handles DROP+ADD CONSTRAINT correctly;
    // this is purely a test-harness workaround: widen the constraint at its
    // point of origin (001) and skip the now-redundant drop/add in 004.
    if (file === '001_init.sql') {
      sql = sql.replace(
        "CHECK (source IN ('Website','WhatsApp','Facebook','Instagram','Phone','Referral','Other'))",
        "CHECK (source IN ('Website','WhatsApp','Facebook','Instagram','Phone','Referral','Other','GoogleAds','Manual','CSV','API','Form','GoogleSheet'))"
      );
      sql = sql.replace(
        "role TEXT NOT NULL CHECK (role IN ('owner', 'sales'))",
        "role TEXT NOT NULL CHECK (role IN ('owner', 'sales', 'developer', 'manager'))"
      );
      sql = sql.replace(
        "status TEXT NOT NULL DEFAULT 'New'\n    CHECK (status IN ('New','Contacted','Qualified','Proposal','Negotiation','Won','Lost'))",
        "status TEXT NOT NULL DEFAULT 'New'\n    CHECK (status IN ('New','Contacted','Replied','Qualified','Proposal','Negotiation','Won','Lost'))"
      );
    }
    if (file === '004_lead_attribution.sql') {
      sql = sql.replace(/ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_source_check;[\s\S]*?'GoogleAds','Manual','CSV','API','Form'\s*\)\s*\);/, '');
    }
    if (file === '011_developer_dashboard.sql') {
      sql = sql.replace(
        /ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;\s*ALTER TABLE users ADD CONSTRAINT users_role_check CHECK \(role IN \('owner', 'sales', 'developer'\)\);/,
        ''
      );
    }
    if (file === '014_lead_source_sheet.sql') {
      // This migration is nothing but the widened constraint (already baked
      // into 001's patch above), so stripping it leaves an empty string —
      // pg-mem's parser errors on that, so skip the file entirely in tests.
      continue;
    }
    if (file === '015_crm_upgrade.sql') {
      // The role/status widenings are already baked into 001's patch above
      // (same pg-mem DROP/ADD CONSTRAINT limitation as 004/011/014); only
      // the real ADD COLUMN statement needs to actually run here.
      sql = sql.replace(/ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;[\s\S]*?'manager'\s*\)\s*\);/, '');
      sql = sql.replace(/ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_status_check;[\s\S]*?'Won','Lost'\s*\)\s*\);/, '');
    }

    db.public.none(sql);
  }

  setPool(pool as unknown as import('pg').Pool);
}
