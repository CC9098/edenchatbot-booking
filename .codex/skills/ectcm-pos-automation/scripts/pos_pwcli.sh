#!/usr/bin/env bash
set -euo pipefail

export CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
PWCLI="${PWCLI:-$CODEX_HOME/skills/playwright/scripts/playwright_cli.sh}"
SESSION="${ECTCM_POS_SESSION:-ectcm-pos}"

if ! command -v npx >/dev/null 2>&1; then
  echo "npx is required for Playwright CLI." >&2
  exit 1
fi

if [[ ! -x "$PWCLI" ]]; then
  echo "Playwright CLI wrapper not found: $PWCLI" >&2
  exit 1
fi

if [[ ${#SESSION} -gt 16 ]]; then
  echo "ECTCM_POS_SESSION must be 16 characters or fewer to avoid Playwright socket path collisions." >&2
  exit 1
fi

exec "$PWCLI" -s="$SESSION" "$@"
