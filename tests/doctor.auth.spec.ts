import { test, expect } from "@playwright/test";
import { createAuthenticatedContext } from "./helpers/auth";
import { getMissingRoleEnvVars } from "./helpers/env";

test("/doctor 權限保護：未登入應跳到 /login", async ({ page }) => {
  await page.goto("/doctor");
  await page.waitForURL(/\/login\?next=%2Fdoctor$/);
  await expect(page.getByRole("heading", { name: "登入 staff 控制台" })).toBeVisible();
  await expect(page.getByText("使用 Google 登入")).toBeVisible();
});

test("/nurse 權限保護：未登入應跳到 /login", async ({ page }) => {
  await page.goto("/nurse");
  await page.waitForURL(/\/login\?next=%2Fnurse$/);
  await expect(page.getByRole("heading", { name: "登入 staff 控制台" })).toBeVisible();
  await expect(page.getByText("使用 Google 登入")).toBeVisible();
});

test("/nurse/quiz 權限保護：未登入應跳到 /login", async ({ page }) => {
  await page.goto("/nurse/quiz");
  await page.waitForURL(/\/login\?next=%2Fnurse%2Fquiz$/);
  await expect(page.getByRole("heading", { name: "登入 staff 控制台" })).toBeVisible();
});

test("/nurse/lesson 權限保護：未登入應跳到 /login", async ({ page }) => {
  await page.goto("/nurse/lesson");
  await page.waitForURL(/\/login\?next=%2Fnurse%2Flesson$/);
  await expect(page.getByRole("heading", { name: "登入 staff 控制台" })).toBeVisible();
});

test("/doctor 登入後流程：可見醫師主頁", async ({ browser }) => {
  const missing = getMissingRoleEnvVars(["doctor"]);
  test.skip(missing.length > 0, `Missing env: ${missing.join(", ")}`);

  const context = await createAuthenticatedContext(browser, "doctor");
  const page = await context.newPage();

  try {
    await page.goto("/doctor");
    await page.waitForURL("**/doctor");

    await expect(page.getByRole("heading", { name: "醫師主頁" })).toBeVisible();
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

    await expect(page.getByRole("heading", { name: "醫師主頁" })).toBeVisible();
  } finally {
    await context.close();
  }
});

test("/nurse 登入後流程：可見姑娘主頁", async ({ browser }) => {
  const missing = getMissingRoleEnvVars(["doctor"]);
  test.skip(missing.length > 0, `Missing env: ${missing.join(", ")}`);

  const context = await createAuthenticatedContext(browser, "doctor");
  const page = await context.newPage();

  try {
    await page.goto("/nurse");
    await page.waitForURL("**/nurse");

    await expect(page.getByRole("heading", { name: "姑娘主頁" })).toBeVisible();
    await expect(page.getByRole("button", { name: "登出" })).toBeVisible();
  } finally {
    await context.close();
  }
});

test("/nurse/quiz 登入後流程：可見培訓影片與測驗", async ({ browser }) => {
  const missing = getMissingRoleEnvVars(["doctor"]);
  test.skip(missing.length > 0, `Missing env: ${missing.join(", ")}`);

  const context = await createAuthenticatedContext(browser, "doctor");
  const page = await context.newPage();

  try {
    await page.goto("/nurse/quiz");
    await page.waitForURL("**/nurse/quiz");

    await expect(page.getByRole("heading", { name: "姑娘培訓平台" })).toBeVisible();
    await expect(page.getByTitle("播放影片：前台儀態要求")).toBeVisible();
    await expect(page.getByRole("button", { name: /第 10 條/ })).toBeVisible();
    await expect(page.getByText("病人入到前台時，姑娘最先應保持哪一類表現？")).toBeVisible();

    await page.getByRole("button", { name: "B 清楚、有禮、主動確認需要" }).click();

    await expect(page.getByText("答對", { exact: true })).toBeVisible();
  } finally {
    await context.close();
  }
});

test("/nurse/lesson 登入後流程：可見寄藥情境課", async ({ browser }) => {
  const missing = getMissingRoleEnvVars(["doctor"]);
  test.skip(missing.length > 0, `Missing env: ${missing.join(", ")}`);

  const context = await createAuthenticatedContext(browser, "doctor");
  const page = await context.newPage();

  try {
    await page.goto("/nurse/lesson");
    await page.waitForURL("**/nurse/lesson");

    await expect(page.getByRole("heading", { name: "寄藥情境課" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Step 2/ })).toBeVisible();
    await page.getByRole("button", { name: /可以，我先查運費/ }).click();
    await expect(page.getByText("可以進下一關")).toBeVisible();
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
    await expect(page.getByRole("heading", { name: "醫師主頁" })).toHaveCount(0);
  } finally {
    await context.close();
  }
});
