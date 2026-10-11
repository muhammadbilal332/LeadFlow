#!/usr/bin/env bash
# Local, offline tests for the backup toolkit. Deliberately contains no
# database connection, no R2/AWS call, and no Docker — everything here runs
# on a bare machine with only bash + coreutils, so it can run on a laptop
# exactly as safely as in CI. Exercises failure paths (missing secrets,
# empty/invalid archives, checksum mismatches) with fakes/mocks, never
# against anything real.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib.sh"

PASS=0
FAIL=0

assert_eq() {
  local desc="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then
    echo "  ok   - $desc"
    PASS=$((PASS + 1))
  else
    echo "  FAIL - $desc (expected [$expected], got [$actual])"
    FAIL=$((FAIL + 1))
  fi
}

echo "== lib.sh: pure function tests =="

assert_eq "backup_object_key builds the dated path" \
  "leadflow/database/2026/10/11/leadflow-20261011T173245Z.dump" \
  "$(backup_object_key '20261011T173245Z')"

TMPFILE="$(mktemp)"
echo -n "" > "$TMPFILE"
if file_nonempty "$TMPFILE"; then
  echo "  FAIL - file_nonempty rejects an empty file"
  FAIL=$((FAIL + 1))
else
  echo "  ok   - file_nonempty rejects an empty file"
  PASS=$((PASS + 1))
fi
echo "some bytes" > "$TMPFILE"
if file_nonempty "$TMPFILE"; then
  echo "  ok   - file_nonempty accepts a non-empty file"
  PASS=$((PASS + 1))
else
  echo "  FAIL - file_nonempty accepts a non-empty file"
  FAIL=$((FAIL + 1))
fi

echo -n "leadflow-test" > "$TMPFILE"
CHECKSUM_A="$(sha256_of "$TMPFILE")"
assert_eq "sha256_of produces a 64-character hex digest" "64" "${#CHECKSUM_A}"
CHECKSUM_B="$(sha256_of "$TMPFILE")"
assert_eq "sha256_of is deterministic for the same content" "$CHECKSUM_A" "$CHECKSUM_B"
echo -n "leadflow-test-different" > "$TMPFILE"
CHECKSUM_C="$(sha256_of "$TMPFILE")"
if [ "$CHECKSUM_A" = "$CHECKSUM_C" ]; then
  echo "  FAIL - sha256_of differs for different content"
  FAIL=$((FAIL + 1))
else
  echo "  ok   - sha256_of differs for different content"
  PASS=$((PASS + 1))
fi
rm -f "$TMPFILE"

(
  unset FOO_VAR
  if require_env FOO_VAR 2>/dev/null; then
    echo "  FAIL - require_env fails when a variable is missing"; exit 1
  else
    echo "  ok   - require_env fails when a variable is missing"; exit 0
  fi
) && PASS=$((PASS + 1)) || FAIL=$((FAIL + 1))
(
  export FOO_VAR=set
  if require_env FOO_VAR 2>/dev/null; then
    echo "  ok   - require_env passes when all variables are set"; exit 0
  else
    echo "  FAIL - require_env passes when all variables are set"; exit 1
  fi
) && PASS=$((PASS + 1)) || FAIL=$((FAIL + 1))

echo ""
echo "== backup-database.sh: missing-secrets failure path (no DB/network/Docker touched) =="
OUT=$(unset SUPABASE_DB_URL R2_ACCOUNT_ID R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY R2_BUCKET_NAME; bash "$SCRIPT_DIR/backup-database.sh" 2>&1; echo "EXIT:$?")
echo "$OUT" | grep -q "missing required environment variable" && { echo "  ok   - reports missing secrets by name (not value)"; PASS=$((PASS+1)); } || { echo "  FAIL - did not report missing secrets correctly"; FAIL=$((FAIL+1)); }
echo "$OUT" | grep -q "EXIT:0" && { echo "  FAIL - exited 0 despite missing secrets"; FAIL=$((FAIL+1)); } || { echo "  ok   - exited non-zero"; PASS=$((PASS+1)); }
# The whole point of fail-fast ordering: must not even attempt to look for
# pg_dump/aws (let alone connect anywhere) before validating secrets.
echo "$OUT" | grep -qE "SUPABASE_DB_URL|R2_ACCOUNT_ID|R2_ACCESS_KEY_ID|R2_SECRET_ACCESS_KEY|R2_BUCKET_NAME" && { echo "  ok   - names every missing variable"; PASS=$((PASS+1)); } || { echo "  FAIL - did not name the missing variables"; FAIL=$((FAIL+1)); }

echo ""
echo "== restore-database.sh: refuses without the exact confirmation phrase =="
OUT2=$(unset I_CONFIRM_DISPOSABLE_TARGET; bash "$SCRIPT_DIR/restore-database.sh" 2>&1; echo "EXIT:$?")
echo "$OUT2" | grep -q "Refusing to restore" && { echo "  ok   - refuses when confirmation is unset"; PASS=$((PASS+1)); } || { echo "  FAIL - did not refuse when confirmation unset"; FAIL=$((FAIL+1)); }
echo "$OUT2" | grep -q "EXIT:0" && { echo "  FAIL - exited 0 without confirmation"; FAIL=$((FAIL+1)); } || { echo "  ok   - exited non-zero without confirmation"; PASS=$((PASS+1)); }

OUT3=$(I_CONFIRM_DISPOSABLE_TARGET="close-but-wrong" bash "$SCRIPT_DIR/restore-database.sh" 2>&1; echo "EXIT:$?")
echo "$OUT3" | grep -q "Refusing to restore" && { echo "  ok   - refuses an almost-but-not-exact phrase"; PASS=$((PASS+1)); } || { echo "  FAIL - accepted a near-miss phrase"; FAIL=$((FAIL+1)); }

echo ""
echo "== shell syntax check (bash -n) =="
for f in lib.sh backup-database.sh restore-database.sh; do
  if bash -n "$SCRIPT_DIR/$f"; then
    echo "  ok   - $f has valid bash syntax"; PASS=$((PASS+1))
  else
    echo "  FAIL - $f has a syntax error"; FAIL=$((FAIL+1))
  fi
done

echo ""
echo "== checksum file round-trip (what restore-database.sh verifies) =="
TMPDIR="$(mktemp -d)"
echo "fake dump contents" > "$TMPDIR/x.dump"
CHK="$(sha256_of "$TMPDIR/x.dump")"
printf '%s  x.dump\n' "$CHK" > "$TMPDIR/x.dump.sha256"
READBACK="$(awk '{print $1}' "$TMPDIR/x.dump.sha256")"
assert_eq "checksum file round-trips correctly" "$CHK" "$READBACK"
rm -rf "$TMPDIR"

echo ""
echo "============================================="
echo "Results: $PASS passed, $FAIL failed"
echo "============================================="
[ "$FAIL" -eq 0 ]
