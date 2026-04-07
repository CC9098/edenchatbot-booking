#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! command -v npx >/dev/null 2>&1; then
  echo "npx is required to run the daily POS sync planner." >&2
  exit 1
fi

exec npx tsx "$SCRIPT_DIR/generate-pos-sync-plan.ts" "$@"
