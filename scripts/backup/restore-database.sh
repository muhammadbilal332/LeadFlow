#!/usr/bin/env bash
# Downloads a LeadFlow database backup from R2, verifies its checksum and
# structure, and restores it into a target Postgres database.
#
# SAFETY: this script refuses to run unless I_CONFIRM_DISPOSABLE_TARGET is
# exactly "yes-this-is-disposable". There is no default target — the caller
# must explicitly supply RESTORE_TARGET_DB_URL every time. Never point this
# at the production LeadFlow database.
#
# Required environment variables:
#   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME
#   OBJECT_KEY                  - the backup's object key, e.g.
#                                  leadflow/database/2026/10/11/leadflow-20261011T173245Z.dump
#   RESTORE_TARGET_DB_URL        - connection string of a disposable Postgres
#                                  database to restore into. Must not be the
#                                  production LeadFlow database.
#   I_CONFIRM_DISPOSABLE_TARGET  - must equal "yes-this-is-disposable"
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./lib.sh
source "$SCRIPT_DIR/lib.sh"

if [ "${I_CONFIRM_DISPOSABLE_TARGET:-}" != "yes-this-is-disposable" ]; then
  log "ERROR: I_CONFIRM_DISPOSABLE_TARGET must be exactly 'yes-this-is-disposable'. Refusing to restore. This script must never be pointed at the production database."
  exit 1
fi

require_env R2_ACCOUNT_ID R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY R2_BUCKET_NAME OBJECT_KEY RESTORE_TARGET_DB_URL || exit 1

command -v pg_restore >/dev/null 2>&1 || { log "ERROR: pg_restore is not installed"; exit 1; }
command -v aws >/dev/null 2>&1 || { log "ERROR: aws CLI is not installed"; exit 1; }

WORKDIR="$(mktemp -d)"
DUMP_FILE="$WORKDIR/restore.dump"
CHECKSUM_FILE="$WORKDIR/restore.dump.sha256"
cleanup() { rm -rf "$WORKDIR"; }
trap cleanup EXIT

R2_ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"
export AWS_DEFAULT_REGION="auto"

log "Downloading $OBJECT_KEY ..."
aws s3 cp "s3://$R2_BUCKET_NAME/$OBJECT_KEY" "$DUMP_FILE" --endpoint-url "$R2_ENDPOINT" || { log "ERROR: download of dump failed"; exit 1; }
aws s3 cp "s3://$R2_BUCKET_NAME/$OBJECT_KEY.sha256" "$CHECKSUM_FILE" --endpoint-url "$R2_ENDPOINT" || { log "ERROR: download of checksum failed"; exit 1; }

file_nonempty "$DUMP_FILE" || { log "ERROR: downloaded dump is missing or empty"; exit 1; }

log "Verifying checksum..."
EXPECTED="$(awk '{print $1}' "$CHECKSUM_FILE")"
ACTUAL="$(sha256_of "$DUMP_FILE")"
if [ "$EXPECTED" != "$ACTUAL" ]; then
  log "ERROR: checksum mismatch. Expected $EXPECTED, got $ACTUAL. The downloaded file may be corrupt or tampered with."
  exit 1
fi
log "Checksum OK: $ACTUAL"

log "Validating archive structure..."
pg_restore --list "$DUMP_FILE" >/dev/null 2>&1 || { log "ERROR: archive failed structural validation"; exit 1; }

log "Restoring into the target database (this target must be disposable)..."
if ! pg_restore --dbname="$RESTORE_TARGET_DB_URL" --clean --if-exists --no-owner --no-privileges "$DUMP_FILE"; then
  log "ERROR: pg_restore reported failures (see output above for details)"
  exit 1
fi

log "Restore completed. Verify table/row counts against the source before trusting this for anything."
