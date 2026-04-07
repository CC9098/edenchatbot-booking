#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PWCLI="$SCRIPT_DIR/pos_pwcli.sh"

"$PWCLI" run-code "async (page) => {
  const clicked = [];
  for (const name of ['關閉', '×']) {
    const buttons = page.getByRole('button', { name });
    const count = await buttons.count();
    for (let i = 0; i < count; i += 1) {
      const button = buttons.nth(i);
      try {
        if (await button.isVisible({ timeout: 500 })) {
          await button.click({ timeout: 1000 });
          clicked.push(name);
          await page.waitForTimeout(200);
        }
      } catch {
        // Ignore popup buttons that disappear or are covered.
      }
    }
  }
  return { clickedCount: clicked.length, clicked };
}"
