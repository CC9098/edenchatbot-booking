import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { ensurePatientAuthState } from "./helpers/chat-auth-state";
import { getBaseUrl, getMissingRoleEnvVars } from "./helpers/env";

type ChatCheck = {
  prompt: string;
  answerPreview: string;
  status: number;
  ok: boolean;
  capturedAt: string;
};

const PROMPTS = [
  "我最近瞓得唔好，請用三個簡單步驟幫我改善作息。",
  "我壓力大同肩頸緊，今日可以即刻做啲咩？",
  "如果我想預約調理，通常第一步要準備咩資料？",
];

function createRunDir(): { runId: string; dir: string } {
  const runId = new Date().toISOString().replace(/[.:]/g, "-");
  const dir = path.join("output", "playwright", "chat-ai", runId);
  fs.mkdirSync(dir, { recursive: true });
  return { runId, dir };
}

function normalize(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

test("ai chatbot regression (persistent auth state)", async ({ browser }) => {
  const missing = getMissingRoleEnvVars(["patient"]);
  test.skip(missing.length > 0, `Missing env: ${missing.join(", ")}`);

  const statePath = await ensurePatientAuthState(browser);
  const context = await browser.newContext({
    baseURL: getBaseUrl(),
    storageState: statePath,
  });
  const page = await context.newPage();
  const { runId, dir } = createRunDir();
  const checks: ChatCheck[] = [];

  try {
    await page.goto("/chat");
    await expect(page.getByRole("heading", { name: "醫天圓 AI 諮詢" })).toBeVisible();

    const textarea = page.locator("textarea").first();
    const sendButton = page.getByRole("button", { name: "送出訊息" });
    const assistantBubbles = page.locator("div.rounded-2xl.rounded-bl-md p");

    for (let i = 0; i < PROMPTS.length; i += 1) {
      const prompt = PROMPTS[i];
      const assistantCountBefore = await assistantBubbles.count();

      await textarea.fill(prompt);

      const apiPromise = page.waitForResponse(
        (res) => res.url().includes("/api/chat/v2") && res.request().method() === "POST",
        { timeout: 90_000 }
      );

      await sendButton.click();
      await expect(page.getByText(prompt)).toBeVisible();

      const api = await apiPromise;
      const status = api.status();
      const ok = api.ok();

      let apiAnswer = "";
      try {
        const body = (await api.json()) as { reply?: string; message?: string };
        apiAnswer = normalize(body.reply || body.message || "");
      } catch {
        apiAnswer = "";
      }

      await expect(async () => {
        const afterCount = await assistantBubbles.count();
        expect(afterCount).toBeGreaterThan(assistantCountBefore);
      }).toPass({ timeout: 30_000 });

      const uiAnswer = normalize((await assistantBubbles.last().innerText()) || "");
      const answer = uiAnswer || apiAnswer;
      expect(answer.length).toBeGreaterThan(0);

      const screenshotPath = path.join(dir, `q${String(i + 1).padStart(2, "0")}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });

      checks.push({
        prompt,
        answerPreview: answer.slice(0, 200),
        status,
        ok,
        capturedAt: new Date().toISOString(),
      });
    }

    const evidencePath = path.join(dir, "evidence.json");
    fs.writeFileSync(
      evidencePath,
      JSON.stringify(
        {
          runId,
          generatedAt: new Date().toISOString(),
          page: "/chat",
          storageStatePath: statePath,
          checks,
        },
        null,
        2
      ),
      "utf-8"
    );

    await test.info().attach("chat-ai-evidence", {
      path: evidencePath,
      contentType: "application/json",
    });

    const failed = checks.find((item) => !item.ok);
    expect(failed, "At least one /api/chat/v2 request failed.").toBeUndefined();
  } finally {
    try {
      await context.close();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("ENOENT") || !message.includes(".trace")) {
        throw error;
      }
    }
  }
});
