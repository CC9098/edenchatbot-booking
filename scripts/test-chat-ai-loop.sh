#!/usr/bin/env bash
set -u

INTERVAL_SECONDS="${1:-300}"

if ! [[ "$INTERVAL_SECONDS" =~ ^[0-9]+$ ]] || [[ "$INTERVAL_SECONDS" -lt 30 ]]; then
  echo "Usage: bash ./scripts/test-chat-ai-loop.sh [interval_seconds>=30]"
  exit 1
fi

while true; do
  echo ""
  echo "[chat-ai-loop] $(date '+%Y-%m-%d %H:%M:%S') running..."
  npm run test:chat:ai
  exit_code=$?

  if [[ "$exit_code" -ne 0 ]]; then
    echo "[chat-ai-loop] test failed with exit code $exit_code"
  else
    echo "[chat-ai-loop] test passed"
  fi

  echo "[chat-ai-loop] next run in ${INTERVAL_SECONDS}s"
  sleep "$INTERVAL_SECONDS"
done
