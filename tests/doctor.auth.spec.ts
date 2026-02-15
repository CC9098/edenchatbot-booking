import { test, expect } from "@playwright/test";
import { createAuthenticatedContext } from "./helpers/auth";
import { getMissingRoleEnvVars } from "./helpers/env";

test("/doctor 權限保護：未登入應跳到 /login", async ({ page }) => {
  await page.goto("/doctor");
  await page.waitForURL("**/login**");
  await expect(page.getByText("使用 Google 登入")).toBeVisible();
});

test("/doctor 登入後流程：可見病人列表", async ({ browser }) => {
  const missing = getMissingRoleEnvVars(["doctor"]);
  test.skip(missing.length > 0, `Missing env: ${missing.join(", ")}`);

  const context = await createAuthenticatedContext(browser, "doctor");
  const page = await context.newPage();

  try {
    await page.goto("/doctor");
    await page.waitForURL("**/doctor");

    await expect(page.getByRole("heading", { name: "病人列表" })).toBeVisible();
    await expect(page.getByRole("button", { name: "登出" })).toBeVisible();
  } finally {
    await context.close();
  }
});
