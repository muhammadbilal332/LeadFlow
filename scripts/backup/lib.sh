#!/usr/bin/env bash
# Shared helpers for the LeadFlow database backup system. Sourced by
# backup-database.sh and restore-database.sh, and exercised directly by
# backup-database.test.sh. Kept dependency-free (plain POSIX/bash + coreutils)
# so it runs identically on a GitHub Actions ubuntu-latest runner and on a
# developer's machine.
#
# Every function here is careful never to print a secret's VALUE — only
# whether a variable is set, and non-sensitive facts (sizes, checksums,
# timestamps, object keys).

set -uo pipefail

# log "message" - timestamped, non-sensitive status line.
log() {
  printf '[%s] %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$1"
}

# require_env VAR_NAME [VAR_NAME ...] - fails fast (without printing any
# value) if any named environment variable is unset or empty.
require_env() {
  local missing=()
  local name
  for name in "$@"; do
    if [ -z "${!name:-}" ]; then
      missing+=("$name")
    fi
  done
  if [ "${#missing[@]}" -gt 0 ]; then
    log "ERROR: missing required environment variable(s): ${missing[*]}"
    return 1
  fi
  return 0
}

# utc_now_compact - UTC timestamp formatted for use in an object key, e.g. 20261011T173245Z.
utc_now_compact() {
  date -u '+%Y%m%dT%H%M%SZ'
}

# backup_object_key TIMESTAMP_COMPACT - the dated R2 object key for a dump,
# e.g. leadflow/database/2026/10/11/leadflow-20261011T173245Z.dump
# Takes the timestamp as an argument (rather than recomputing it) so the
# date-derived path and the filename's own timestamp can never drift apart.
backup_object_key() {
  local ts="$1"
  local year="${ts:0:4}"
  local month="${ts:4:2}"
  local day="${ts:6:2}"
  printf 'leadflow/database/%s/%s/%s/leadflow-%s.dump' "$year" "$month" "$day" "$ts"
}

# file_nonempty PATH - true if the file exists and has a nonzero size.
file_nonempty() {
  local path="$1"
  [ -s "$path" ]
}

# sha256_of PATH - prints just the hex digest (portable across Linux/macOS/Git Bash).
sha256_of() {
  local path="$1"
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$path" | awk '{print $1}'
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$path" | awk '{print $1}'
  else
    log "ERROR: neither sha256sum nor shasum is available"
    return 1
  fi
}
