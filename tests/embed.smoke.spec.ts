import { test, expect } from "@playwright/test";

test("/embed smoke（widget 顯示/開關）", async ({ page }) => {
  await page.goto("/embed");

  const launcher = page.getByRole("button", { name: "立即諮詢" });
  await expect(launcher).toBeVisible();

  await launcher.click();
  await expect(page.getByText("醫天圓小助手", { exact: true })).toBeVisible();
  const collapseButton = page.locator('button[aria-label="收起"]');
  await expect(collapseButton).toBeVisible();

  await collapseButton.click();
  await expect(page.getByText("醫天圓小助手", { exact: true })).toBeHidden();
  await expect(page.getByRole("button", { name: "立即諮詢" })).toBeVisible();
});
