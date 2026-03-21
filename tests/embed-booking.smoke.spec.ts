import { expect, test } from "@playwright/test";

test("/embed/booking smoke（standalone booking iframe entry）", async ({ page }) => {
  await page.goto("/embed/booking");

  await expect(page.getByRole("heading", { name: "預約服務" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "選擇醫師" })).toBeVisible();
  await expect(page.getByRole("button", { name: "下一步：選擇日期與時間" })).toBeVisible();
});
