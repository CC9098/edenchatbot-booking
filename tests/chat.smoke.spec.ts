import { test, expect } from "@playwright/test";
import { createAuthenticatedContext } from "./helpers/auth";
import { getMissingRoleEnvVars } from "./helpers/env";

test("chat smoke + 基本對話流程", async ({ browser }) => {
  const missing = getMissingRoleEnvVars(["patient"]);
  test.skip(missing.length > 0, `Missing env: ${missing.join(", ")}`);

  const context = await createAuthenticatedContext(browser, "patient");
  const page = await context.newPage();

  try {
    await page.goto("/chat");

    await expect(page.getByRole("heading", { name: "醫天圓 AI 諮詢" })).toBeVisible();
    await expect(
      page.getByText("你好！我是醫天圓 AI 體質顧問", { exact: false })
    ).toBeVisible();

    const prompt = "請用一句話介紹你可以幫我做咩。";
    const responsePromise = page.waitForResponse(
      (res) => res.url().includes("/api/chat/v2") && res.request().method() === "POST"
    );

    await page.getByPlaceholder("輸入你的健康問題...").fill(prompt);
    await page.keyboard.press("Enter");
    await expect(page.getByText(prompt)).toBeVisible();

    const response = await responsePromise;
    expect(response.ok()).toBeTruthy();
    const body = (await response.json()) as { reply?: string; message?: string };
    const answer = (body.reply || body.message || "").trim();
    expect(answer.length).toBeGreaterThan(0);

    await expect(page.getByText(answer.slice(0, Math.min(answer.length, 20)))).toBeVisible();
  } finally {
    await context.close();
  }
});
