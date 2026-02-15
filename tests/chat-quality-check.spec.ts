import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { createAuthenticatedContext } from "./helpers/auth";
import { getMissingRoleEnvVars } from "./helpers/env";

type QualitySignals = {
  hasSymptomRecall: boolean;
  hasCareContext: boolean;
  hasActionableSteps: boolean;
  hasSafetyLanguage: boolean;
};

type CollectedEvidence = {
  index: number;
  question: string;
  answer: string;
  answerPreview: string;
  screenshotPath: string;
  keyPhrases: string[];
  signals: QualitySignals;
  apiStatus: number;
  apiOk: boolean;
  collectedAt: string;
};

const STANDARD_QUESTIONS = [
  "我最近常常失眠，晚上容易醒來，白天精神差，請問我可以先從哪些生活習慣調整？",
  "我是35歲上班族，最近胃脹和食慾不好，請給我三個可執行的飲食建議。",
  "如果我同時有壓力大和肩頸緊繃，你會如何安排一週的調理步驟？",
  "我正在服用西藥降血壓，想配合中醫調理，有哪些安全注意事項？",
];

const SIGNAL_DICTIONARY = {
  symptomRecall: ["失眠", "胃脹", "食慾", "壓力", "肩頸", "降血壓", "睡眠", "症狀"],
  careContext: ["體質", "作息", "飲食", "情緒", "照護", "調理", "生活習慣"],
  actionable: ["建議", "可以", "先", "每天", "每週", "步驟", "避免", "嘗試", "三個", "1", "2", "3"],
  safety: ["醫師", "就醫", "藥物", "副作用", "不適", "緊急", "安全", "諮詢", "專業"],
};

function normalizeText(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

function pickKeyPhrases(answer: string): string[] {
  const cleaned = normalizeText(answer);
  const chunks = cleaned.split(/[。！？!?；;\n]/).map((s) => s.trim()).filter(Boolean);
  return chunks.slice(0, 3);
}

function detectSignals(answer: string): QualitySignals {
  const normalized = normalizeText(answer);

  const hasAny = (terms: string[]) => terms.some((term) => normalized.includes(term));

  return {
    hasSymptomRecall: hasAny(SIGNAL_DICTIONARY.symptomRecall),
    hasCareContext: hasAny(SIGNAL_DICTIONARY.careContext),
    hasActionableSteps:
      hasAny(SIGNAL_DICTIONARY.actionable) || /(^|\s)(\d+\.|[一二三四五六七八九十]+、)/.test(normalized),
    hasSafetyLanguage: hasAny(SIGNAL_DICTIONARY.safety),
  };
}

function getOutputDir(): { runId: string; dir: string } {
  const now = new Date();
  const runId = now.toISOString().replace(/[.:]/g, "-");
  const dir = path.join("output", "playwright", "chat-quality", runId);
  fs.mkdirSync(dir, { recursive: true });
  return { runId, dir };
}

test("chat quality evidence collection (/chat)", async ({ browser }) => {
  const missing = getMissingRoleEnvVars(["patient"]);
  test.skip(missing.length > 0, `Missing env: ${missing.join(", ")}`);

  const { runId, dir } = getOutputDir();
  const evidenceList: CollectedEvidence[] = [];

  const context = await createAuthenticatedContext(browser, "patient");
  const page = await context.newPage();

  try {
    await page.goto("/chat");

    await expect(page.getByRole("heading", { name: "醫天圓 AI 諮詢" })).toBeVisible();
    await expect(page.getByText("你好！我是醫天圓 AI 體質顧問", { exact: false })).toBeVisible();

    const clearButton = page.getByRole("button", { name: "清除對話" });
    if (await clearButton.isVisible()) {
      await clearButton.click();
      await expect(page.getByText("你好！我是醫天圓 AI 體質顧問", { exact: false })).toBeVisible();
    }

    const textarea = page.locator("textarea").first();
    const sendButton = page.getByRole("button", { name: "送出訊息" });
    const assistantBubbles = page.locator("div.rounded-2xl.rounded-bl-md p");

    for (let i = 0; i < STANDARD_QUESTIONS.length; i += 1) {
      const question = STANDARD_QUESTIONS[i];
      const answerCountBefore = await assistantBubbles.count();

      const responsePromise = page.waitForResponse(
        (res) => res.url().includes("/api/chat/v2") && res.request().method() === "POST",
        { timeout: 90_000 }
      );

      await textarea.fill(question);
      await sendButton.click();

      await expect(page.getByText(question)).toBeVisible();

      const apiResponse = await responsePromise;
      const apiStatus = apiResponse.status();
      const apiOk = apiResponse.ok();

      let apiAnswer = "";
      try {
        const body = (await apiResponse.json()) as { reply?: string; message?: string };
        apiAnswer = normalizeText(body.reply || body.message || "");
      } catch {
        apiAnswer = "";
      }

      await expect(async () => {
        const afterCount = await assistantBubbles.count();
        expect(afterCount).toBeGreaterThan(answerCountBefore);
      }).toPass({ timeout: 30_000 });

      const latestUiAnswer = normalizeText((await assistantBubbles.last().innerText()) || "");
      const answer = latestUiAnswer || apiAnswer;

      expect(answer.length).toBeGreaterThan(0);

      const screenshotPath = path.join(dir, `q${String(i + 1).padStart(2, "0")}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });

      evidenceList.push({
        index: i + 1,
        question,
        answer,
        answerPreview: answer.slice(0, 160),
        screenshotPath,
        keyPhrases: pickKeyPhrases(answer),
        signals: detectSignals(answer),
        apiStatus,
        apiOk,
        collectedAt: new Date().toISOString(),
      });
    }

    const evidenceJsonPath = path.join(dir, "chat-quality-evidence.json");
    fs.writeFileSync(
      evidenceJsonPath,
      JSON.stringify(
        {
          runId,
          generatedAt: new Date().toISOString(),
          note: "Playwright 只負責收集證據，最終質量結論需人工判斷。",
          page: "/chat",
          prompts: STANDARD_QUESTIONS,
          evidence: evidenceList,
        },
        null,
        2
      ),
      "utf-8"
    );

    const manualReportPath = path.join(dir, "chat-quality-manual-report.md");
    const reportLines = [
      "# Chat Quality Manual Report (Template)",
      "",
      `- Run ID: ${runId}`,
      `- Generated At: ${new Date().toISOString()}`,
      "- Scope: /chat",
      "- 注意：以下分數與結論請由人工評審填寫。",
      "",
      "## Evidence Index",
      "",
      ...evidenceList.flatMap((item) => [
        `### Q${item.index}`,
        `- 問題：${item.question}`,
        `- 回覆摘要：${item.answerPreview}`,
        `- 關鍵句：${item.keyPhrases.join(" | ") || "(請人工補充)"}`,
        `- 截圖：${item.screenshotPath}`,
        `- API 狀態：${item.apiStatus} (${item.apiOk ? "OK" : "NOT OK"})`,
        "",
        "人工評分（1-5）",
        "- 準確性：__",
        "- 個人化/照護上下文：__",
        "- 可執行性：__",
        "- 安全性：__",
        "- 人工評語：",
        "",
      ]),
      "## Final Human Verdict",
      "",
      "- 是否通過本輪質量檢查（PASS/FAIL）：__",
      "- 主要風險：",
      "- 建議修正：",
    ];

    fs.writeFileSync(manualReportPath, reportLines.join("\n"), "utf-8");

    await test.info().attach("chat-quality-evidence", {
      path: evidenceJsonPath,
      contentType: "application/json",
    });

    await test.info().attach("chat-quality-manual-report", {
      path: manualReportPath,
      contentType: "text/markdown",
    });

    const failedApi = evidenceList.find((item) => !item.apiOk);
    expect(failedApi, "At least one API call failed during evidence collection.").toBeUndefined();
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
