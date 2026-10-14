#!/usr/bin/env bash
# LeadFlow database backup: pg_dump (custom format, schema `public` only) ->
# validate -> checksum -> upload to Cloudflare R2 -> verify upload.
#
# Scope: this backs up the application's own data only (schema `public`,
# ~40 tables). It deliberately excludes Supabase's platform-managed schemas
# (auth, storage, realtime, vault, extensions, graphql, pgbouncer) — LeadFlow
# uses its own JWT auth and never uses Supabase Auth or Supabase Storage
# (confirmed by a repository audit), so those schemas are infrastructure
# Supabase provisions on every project, not application data, and including
# them would make a restore depend on recreating a Supabase-specific
# environment (e.g. the `vault` extension) that a disposable restore target
# wouldn't have.
#
# Required environment variables (see docs/DATABASE_BACKUP_AND_RESTORE.md):
#   SUPABASE_DB_URL      - direct (non-pooled) Postgres connection string,
#                           read-only use is sufficient; pg_dump only reads.
#   R2_ACCOUNT_ID         - Cloudflare account id
#   R2_ACCESS_KEY_ID      - R2 API token access key id (write-only to the
#                            backup bucket is sufficient)
#   R2_SECRET_ACCESS_KEY  - R2 API token secret
#   R2_BUCKET_NAME        - destination R2 bucket (private, LeadFlow-only)
#
# Never echoes the value of any of the above. Exits non-zero on any failure;
# a run is never reported as successful unless every step below succeeded.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./lib.sh
source "$SCRIPT_DIR/lib.sh"

WORKDIR="$(mktemp -d)"
DUMP_FILE="$WORKDIR/leadflow.dump"
CHECKSUM_FILE="$DUMP_FILE.sha256"
START_TIME=$(date +%s)

# Never leaves a dump (which contains customer data) on the runner's disk,
# on success OR failure — this is the one step that must run unconditionally.
cleanup() {
  rm -rf "$WORKDIR"
}
trap cleanup EXIT

fail() {
  log "BACKUP FAILED: $1"
  write_summary "failure" "$1"
  write_outputs "failure" "$1"
  exit 1
}

# Exposes this script's result to later workflow steps (e.g. the Google
# Sheets manifest logger), regardless of whether this step succeeded or
# failed — read via `steps.<id>.outputs.*` with `if: always()` on the
# consuming step. Never includes a secret value; every field here is
# already in the human-readable summary above.
write_outputs() {
  local status="$1"
  # GITHUB_OUTPUT is simple key=value lines — strip any newline so a
  # multi-line error can never corrupt a later line's parsing.
  local error_summary
  error_summary="$(printf '%s' "${2:-}" | tr '\n' ' ')"
  if [ -n "${GITHUB_OUTPUT:-}" ]; then
    {
      echo "status=$status"
      echo "timestamp=${TIMESTAMP:-}"
      echo "object_key=${OBJECT_KEY:-}"
      echo "size_bytes=${SIZE_BYTES:-}"
      echo "checksum=${CHECKSUM:-}"
      echo "duration_seconds=${DURATION:-}"
      echo "error_summary=$error_summary"
    } >> "$GITHUB_OUTPUT"
  fi
}

write_summary() {
  local status="$1"
  local note="${2:-}"
  if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
    {
      echo "### LeadFlow database backup — $status"
      echo ""
      echo "| Field | Value |"
      echo "|---|---|"
      echo "| Status | $status |"
      echo "| UTC timestamp | ${TIMESTAMP:-n/a} |"
      echo "| Object key | ${OBJECT_KEY:-n/a} |"
      echo "| Compressed size | ${SIZE_HUMAN:-n/a} |"
      echo "| SHA-256 | ${CHECKSUM:-n/a} |"
      echo "| Duration | ${DURATION:-n/a}s |"
      echo "| Upload verified | ${UPLOAD_VERIFIED:-no} |"
      [ -n "$note" ] && { echo ""; echo "$note"; }
    } >> "$GITHUB_STEP_SUMMARY"
  fi
}

# --- 1. Validate required environment variables (no values printed) ---
require_env SUPABASE_DB_URL R2_ACCOUNT_ID R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY R2_BUCKET_NAME || fail "missing required environment variable(s)"

command -v pg_dump >/dev/null 2>&1 || fail "pg_dump is not installed"
command -v pg_restore >/dev/null 2>&1 || fail "pg_restore is not installed"
command -v aws >/dev/null 2>&1 || fail "aws CLI is not installed"

TIMESTAMP="$(utc_now_compact)"
OBJECT_KEY="$(backup_object_key "$TIMESTAMP")"
CHECKSUM_KEY="$OBJECT_KEY.sha256"

log "Starting backup $TIMESTAMP -> $OBJECT_KEY"

# --- 2/3. Connect and generate the backup (custom format: compressed,
# supports pg_restore -l for structural validation and selective restore) ---
log "Running pg_dump (schema public only, no owner/privileges for portability)..."
if ! pg_dump "$SUPABASE_DB_URL" \
  --format=custom \
  --compress=9 \
  --schema=public \
  --no-owner \
  --no-privileges \
  --file="$DUMP_FILE"; then
  fail "pg_dump exited non-zero"
fi

# --- 4. Verify the resulting file exists and is not empty ---
file_nonempty "$DUMP_FILE" || fail "dump file is missing or empty"

# --- 5. Validate the archive structurally (reads the custom-format TOC,
# never touches a real database) ---
log "Validating archive structure with pg_restore --list..."
TOC_LINES="$(pg_restore --list "$DUMP_FILE" 2>/dev/null | wc -l | tr -d ' ')" || fail "pg_restore --list could not read the archive"
if [ "${TOC_LINES:-0}" -lt 1 ]; then
  fail "archive table-of-contents is empty — dump is not valid"
fi
log "Archive validated: $TOC_LINES catalog entries"

# --- 6. Checksum ---
CHECKSUM="$(sha256_of "$DUMP_FILE")" || fail "unable to compute checksum"
printf '%s  %s\n' "$CHECKSUM" "$(basename "$DUMP_FILE")" > "$CHECKSUM_FILE"
SIZE_BYTES="$(wc -c < "$DUMP_FILE" | tr -d ' ')"
SIZE_HUMAN="$(numfmt --to=iec-i --suffix=B "$SIZE_BYTES" 2>/dev/null || echo "${SIZE_BYTES} bytes")"
log "Dump size: $SIZE_HUMAN ($SIZE_BYTES bytes). SHA-256: $CHECKSUM"

# --- 7. Upload backup + checksum to R2 (S3-compatible). Defensive: refuse
# to overwrite an existing object at this exact key (should never happen —
# the key is unique to the second — but a collision must never clobber a
# prior valid backup). ---
R2_ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"
export AWS_DEFAULT_REGION="auto"

if aws s3api head-object --endpoint-url "$R2_ENDPOINT" --bucket "$R2_BUCKET_NAME" --key "$OBJECT_KEY" >/dev/null 2>&1; then
  fail "an object already exists at $OBJECT_KEY — refusing to overwrite an existing backup"
fi

log "Uploading dump to r2://$R2_BUCKET_NAME/$OBJECT_KEY ..."
GITHUB_META=(--metadata "backup-timestamp-utc=$TIMESTAMP,sha256=$CHECKSUM,workflow-run-id=${GITHUB_RUN_ID:-local},workflow-run-attempt=${GITHUB_RUN_ATTEMPT:-local}")
if ! aws s3 cp "$DUMP_FILE" "s3://$R2_BUCKET_NAME/$OBJECT_KEY" \
  --endpoint-url "$R2_ENDPOINT" \
  --content-type "application/octet-stream" \
  "${GITHUB_META[@]}"; then
  fail "upload of the dump file to R2 failed"
fi

if ! aws s3 cp "$CHECKSUM_FILE" "s3://$R2_BUCKET_NAME/$CHECKSUM_KEY" \
  --endpoint-url "$R2_ENDPOINT" \
  --content-type "text/plain"; then
  fail "upload of the checksum file to R2 failed (dump itself was uploaded — see $OBJECT_KEY; re-run will not duplicate it since this key already exists, re-upload the checksum manually or re-run a later backup)"
fi

# --- 9. Verify the uploaded object exists and its size matches the local file ---
log "Verifying uploaded object..."
REMOTE_SIZE="$(aws s3api head-object --endpoint-url "$R2_ENDPOINT" --bucket "$R2_BUCKET_NAME" --key "$OBJECT_KEY" --query 'ContentLength' --output text 2>/dev/null)" || fail "could not verify the uploaded object exists"
if [ "$REMOTE_SIZE" != "$SIZE_BYTES" ]; then
  fail "uploaded object size ($REMOTE_SIZE bytes) does not match local dump size ($SIZE_BYTES bytes)"
fi
UPLOAD_VERIFIED="yes"

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

# --- 10. Record non-sensitive metadata ---
log "Backup succeeded in ${DURATION}s. Object: $OBJECT_KEY, size: $SIZE_HUMAN, sha256: $CHECKSUM, run: ${GITHUB_RUN_ID:-local}"
write_summary "success"
write_outputs "success"
