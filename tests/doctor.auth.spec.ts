import { test, expect } from "@playwright/test";
import { createAuthenticatedContext } from "./helpers/auth";
import { getMissingRoleEnvVars } from "./helpers/env";

test("/doctor 權限保護：未登入應跳到 /login", async ({ page }) => {
  await page.goto("/doctor");
  await page.waitForURL(/\/login\?next=%2Fdoctor$/);
  await expect(page.getByRole("heading", { name: "登入醫師控制台" })).toBeVisible();
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

test("/login?next=/doctor 已登入時應返回醫師控制台", async ({ browser }) => {
  const missing = getMissingRoleEnvVars(["doctor"]);
  test.skip(missing.length > 0, `Missing env: ${missing.join(", ")}`);

  const context = await createAuthenticatedContext(browser, "doctor");
  const page = await context.newPage();

  try {
    await page.goto("/login?next=%2Fdoctor");
    await page.waitForURL("**/doctor");

    await expect(page.getByRole("heading", { name: "病人列表" })).toBeVisible();
  } finally {
    await context.close();
  }
});

test("/doctor 已登入但無 staff 權限時應被阻擋", async ({ browser }) => {
  const missing = getMissingRoleEnvVars(["unrelated"]);
  test.skip(missing.length > 0, `Missing env: ${missing.join(", ")}`);

  let context: Awaited<ReturnType<typeof createAuthenticatedContext>>;
  try {
    context = await createAuthenticatedContext(browser, "unrelated");
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    test.skip(
      /invalid login credentials/i.test(message),
      "Invalid E2E_UNRELATED credentials; skipping non-staff guard regression."
    );
    throw error;
  }

  const page = await context.newPage();

  try {
    await page.goto("/doctor");

    await expect(page.getByRole("heading", { name: "無法進入醫師控制台" })).toBeVisible();
    await expect(page.getByText("未有 staff 權限", { exact: false })).toBeVisible();
    await expect(page.getByRole("heading", { name: "病人列表" })).toHaveCount(0);
  } finally {
    await context.close();
  }
});
