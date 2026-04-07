#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <keyword>" >&2
  exit 1
fi

KEYWORD="$1"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PWCLI="$SCRIPT_DIR/pos_pwcli.sh"

json_quote() {
  python3 -c 'import json, sys; print(json.dumps(sys.argv[1]))' "$1"
}

KEYWORD_JSON="$(json_quote "$KEYWORD")"

if [[ "${ECTCM_POS_SKIP_BOOTSTRAP:-0}" != "1" ]]; then
  "$SCRIPT_DIR/login-and-open-register-list.sh" >/dev/null
fi

"$SCRIPT_DIR/dismiss-popups.sh" >/dev/null || true

CODE="$(python3 - "$KEYWORD_JSON" <<'PY'
import sys
keyword = sys.argv[1]
print(f"""async (page) => {{
  const keyword = {keyword};
  const frameLocator = page.frameLocator('iframe[name="ContentIframe"]');
  await frameLocator.getByRole('textbox', {{ name: '顧客編號,姓名,電話,完整證件號' }}).fill(keyword);
  await frameLocator.getByRole('button', {{ name: '搜索顧客' }}).click();
  await page.waitForTimeout(1500);

  const frame = page.frame({{ name: 'ContentIframe' }});
  if (!frame) {{
    throw new Error('ContentIframe not found after search');
  }}

  const body = await frame.locator('body').innerText();
  const rowCountMatch = body.match(/共計:\\s*(\\d+)\\s*條記錄/);
  const resultCount = rowCountMatch ? Number(rowCountMatch[1]) : null;
  const resultStatus =
    resultCount === null ? 'unknown'
    : resultCount === 0 ? 'none'
    : resultCount === 1 ? 'unique'
    : 'multiple';

  return {{
    keyword,
    pageTitle: await page.title(),
    resultCount,
    resultStatus,
    hasAmbiguousResults: resultCount !== null ? resultCount !== 1 : null
  }};
}}""")
PY
)"

"$PWCLI" run-code "$CODE"

if [[ "${ECTCM_POS_DEBUG_SNAPSHOT:-0}" == "1" ]]; then
  "$PWCLI" snapshot
fi
