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

test("/nurse/quiz 登入後流程：可見姑娘小測驗", async ({ browser }) => {
  const missing = getMissingRoleEnvVars(["doctor"]);
  test.skip(missing.length > 0, `Missing env: ${missing.join(", ")}`);

  const context = await createAuthenticatedContext(browser, "doctor");
  const page = await context.newPage();

  try {
    await page.goto("/nurse/quiz");
    await page.waitForURL("**/nurse/quiz");

    await expect(page.getByRole("heading", { name: "前台 RPG 小測驗" })).toBeVisible();
    await expect(page.getByRole("button", { name: "下一關" })).toBeDisabled();

    const correctAnswers = [
      "我先幫您確認清楚，再 WhatsApp 回覆您。",
      "先核對姓名、完整電話或其他資料，再查紀錄。",
      "先查系統可約時段，滿咗就提供最近可約時間。",
      "我可以按診所紀錄處理收據，但保險結果要由保險公司審批。",
      "重新確認姓名、電話、完整地址、方便收件時間。",
      "這類資料不可在一般對話傳，按指定流程交主管。",
    ];

    for (let index = 0; index < correctAnswers.length; index += 1) {
      await page.getByRole("button", { name: correctAnswers[index] }).click();
      if (index < correctAnswers.length - 1) {
        await expect(page.getByText("Clear", { exact: true })).toBeVisible();
        await page.getByRole("button", { name: "下一關" }).click();
      }
    }

    await expect(page.getByText("通關", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "6/6" })).toBeVisible();
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
