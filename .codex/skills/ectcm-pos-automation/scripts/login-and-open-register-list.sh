#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PWCLI="$SCRIPT_DIR/pos_pwcli.sh"

LOGIN_URL="${ECTCM_POS_LOGIN_URL:-https://os.ectcm.com/Login}"
CLINIC_MATCH="${ECTCM_POS_CLINIC_MATCH:-醫天圓中醫診所(佐敦)}"

if [[ -z "${ECTCM_POS_USERNAME:-}" || -z "${ECTCM_POS_PASSWORD:-}" ]]; then
  echo "ECTCM_POS_USERNAME and ECTCM_POS_PASSWORD are required." >&2
  exit 1
fi

json_quote() {
  python3 -c 'import json, sys; print(json.dumps(sys.argv[1]))' "$1"
}

LOGIN_URL_JSON="$(json_quote "$LOGIN_URL")"
USERNAME_JSON="$(json_quote "$ECTCM_POS_USERNAME")"
PASSWORD_JSON="$(json_quote "$ECTCM_POS_PASSWORD")"
CLINIC_MATCH_JSON="$(json_quote "$CLINIC_MATCH")"

if ! "$PWCLI" goto "$LOGIN_URL" >/dev/null 2>&1; then
  "$PWCLI" open "$LOGIN_URL" >/dev/null
fi

cat <<'EOF' >/tmp/ectcm-pos-template.$$
async (page) => {
  const loginUrl = __LOGIN_URL__;
  const username = __USERNAME__;
  const password = __PASSWORD__;
  const clinicMatch = __CLINIC_MATCH__;

  if (!username || !password) {
    throw new Error('Missing ECTCM_POS_USERNAME or ECTCM_POS_PASSWORD');
  }

  await page.goto(loginUrl, { waitUntil: 'domcontentloaded' });
  await page.getByRole('textbox', { name: '輸入賬號' }).fill(username);
  await page.getByRole('textbox', { name: '輸入密碼' }).fill(password);
  await page.getByRole('button', { name: '立即登錄' }).click();

  const clinicFrame = page.frameLocator('iframe[name="MCMSIframe"]');
  const clinicSelect = clinicFrame.locator('#DropListLoginClinic');
  await clinicSelect.waitFor({ state: 'visible', timeout: 15000 });

  const selectedValue = await clinicSelect.evaluate((node, matchText) => {
    const select = node;
    const option = Array.from(select.options).find((item) => item.text.includes(matchText));
    if (!option) return null;
    select.value = option.value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return option.value;
  }, clinicMatch);

  if (!selectedValue) {
    throw new Error(`Clinic option not found for match: ${clinicMatch}`);
  }

  await clinicFrame.getByRole('button', { name: '登 錄' }).click();
  await page.waitForURL(/\/MCMSIndex/, { timeout: 20000 });

  for (const target of [
    page.getByRole('button', { name: '關閉' }).first(),
    page.getByRole('button', { name: '×' }).first(),
  ]) {
    try {
      if (await target.isVisible({ timeout: 1000 })) {
        await target.click({ timeout: 2000 });
      }
    } catch {
      // Ignore optional popups.
    }
  }

  await page.getByRole('link', { name: '診所顧客列表' }).click();
  const contentFrame = page.frameLocator('iframe[name="ContentIframe"]');
  await contentFrame.getByRole('link', { name: '掛號列表' }).waitFor({ state: 'visible', timeout: 15000 });
  await contentFrame.getByRole('link', { name: '掛號列表' }).click();
  await contentFrame.getByRole('button', { name: '快速掛號' }).waitFor({ state: 'visible', timeout: 15000 });
}
EOF

CODE="$(python3 - "$LOGIN_URL_JSON" "$USERNAME_JSON" "$PASSWORD_JSON" "$CLINIC_MATCH_JSON" /tmp/ectcm-pos-template.$$ <<'PY'
import pathlib
import sys

login_url, username, password, clinic_match, template_path = sys.argv[1:6]
template = pathlib.Path(template_path).read_text()
code = (
    template
    .replace("__LOGIN_URL__", login_url)
    .replace("__USERNAME__", username)
    .replace("__PASSWORD__", password)
    .replace("__CLINIC_MATCH__", clinic_match)
)
print(code)
PY
)"

rm -f /tmp/ectcm-pos-template.$$

"$PWCLI" run-code "$CODE"
"$PWCLI" snapshot
