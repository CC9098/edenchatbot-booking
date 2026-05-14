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

test("/nurse/quiz 登入後流程：可見前台放行測驗", async ({ browser }) => {
  const missing = getMissingRoleEnvVars(["doctor"]);
  test.skip(missing.length > 0, `Missing env: ${missing.join(", ")}`);

  const context = await createAuthenticatedContext(browser, "doctor");
  const page = await context.newPage();

  try {
    await page.goto("/nurse/quiz");
    await page.waitForURL("**/nurse/quiz");

    await expect(page.getByRole("heading", { name: "前台安全放行測驗" })).toBeVisible();
    await expect(page.getByRole("button", { name: "下一關" })).toBeDisabled();

    const correctAnswers = [
      "我先幫你查清楚今次收費和優惠，確認後再 WhatsApp 回覆你。",
      "我先核對姓名和完整電話；資料對上後，只講相關預約資料。",
      "我先查系統可約時段；如已滿，提供最近可約時間，急症狀況交當值同事。",
      "我可以按診所紀錄處理收據；能否索償要由保險公司審批。",
      "我先重新確認收件人、電話、完整地址和收件時段，再確認運費和送遞方式。",
      "OTP、密碼和後台權限不能在 WhatsApp 傳；請用正式登入流程或交主管處理。",
    ];

    for (let index = 0; index < correctAnswers.length; index += 1) {
      await page.getByRole("button", { name: correctAnswers[index] }).click();
      if (index < correctAnswers.length - 1) {
        await expect(page.getByText("判斷穩陣", { exact: true })).toBeVisible();
        await page.getByRole("button", { name: "下一關" }).click();
      }
    }

    await expect(page.getByText("可獨立處理低風險前台任務", { exact: true })).toBeVisible();
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
