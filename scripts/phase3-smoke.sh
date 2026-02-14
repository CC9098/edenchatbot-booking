#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
RUN_HTTP_CHECKS="${RUN_HTTP_CHECKS:-0}"

log() {
  printf "\n[%s] %s\n" "phase3" "$1"
}

log "Running lint"
npm run lint

log "Running typecheck"
npm run typecheck

log "Running production build"
npm run build

if [[ "$RUN_HTTP_CHECKS" != "1" ]]; then
  log "Skipping HTTP checks (set RUN_HTTP_CHECKS=1 to enable)"
  exit 0
fi

log "Running API contract smoke checks against ${BASE_URL}"

status_chat=$(curl -s -o /tmp/phase3_chat.out -w "%{http_code}" \
  -X POST "${BASE_URL}/api/chat/v2" \
  -H "Content-Type: application/json" \
  -d '{"messages":[]}')
if [[ "$status_chat" != "400" ]]; then
  echo "Expected /api/chat/v2 invalid payload status 400, got ${status_chat}"
  cat /tmp/phase3_chat.out
  exit 1
fi

status_booking=$(curl -s -o /tmp/phase3_booking.out -w "%{http_code}" \
  -X POST "${BASE_URL}/api/chat/booking/create" \
  -H "Content-Type: application/json" \
  -d '{"doctorId":"x"}')
if [[ "$status_booking" != "400" ]]; then
  echo "Expected /api/chat/booking/create invalid payload status 400, got ${status_booking}"
  cat /tmp/phase3_booking.out
  exit 1
fi

status_availability=$(curl -s -o /tmp/phase3_avail.out -w "%{http_code}" \
  -X POST "${BASE_URL}/api/chat/booking/availability" \
  -H "Content-Type: application/json" \
  -d '{"doctorId":"x"}')
if [[ "$status_availability" != "400" ]]; then
  echo "Expected /api/chat/booking/availability invalid payload status 400, got ${status_availability}"
  cat /tmp/phase3_avail.out
  exit 1
fi

log "HTTP smoke checks passed"
