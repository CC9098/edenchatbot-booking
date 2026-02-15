import { test, expect } from "@playwright/test";
import { createAuthenticatedContext, getFirstPatientUserId } from "./helpers/auth";
import { getMissingRoleEnvVars } from "./helpers/env";

test("Doctor Console CRUD（constitution / instructions / follow-ups）", async ({ browser }) => {
  const missing = getMissingRoleEnvVars(["doctor"]);
  test.skip(missing.length > 0, `Missing env: ${missing.join(", ")}`);

  const context = await createAuthenticatedContext(browser, "doctor");
  const page = await context.newPage();

  try {
    const patientUserId = await getFirstPatientUserId(page.request);
    test.skip(!patientUserId, "No patient assigned to doctor account for CRUD test.");

    await page.goto(`/doctor/patients/${patientUserId}`);
    await expect(page.getByText("返回病人列表")).toBeVisible();

    const marker = `e2e-${Date.now()}`;

    const constitutionSection = page.locator("section", {
      has: page.getByRole("heading", { name: "體質評估" }),
    });
    await constitutionSection.getByRole("button", { name: "編輯" }).click();
    await expect(page.getByText("編輯體質評估")).toBeVisible();
    await page.locator("select").first().selectOption("depleting");
    await page.getByPlaceholder("輸入體質備註...").fill(`備註 ${marker}`);
    await page.getByRole("button", { name: "儲存" }).click();
    await expect(page.getByText(`備註 ${marker}`)).toBeVisible();

    const instructionsSection = page.locator("section", {
      has: page.getByRole("heading", { name: "護理指引" }),
    });
    await instructionsSection.getByRole("button", { name: "+ 新增指引" }).click();
    await expect(page.getByText("新增護理指引")).toBeVisible();
    await page.getByPlaceholder("例: 忌食辛辣").fill(`指引 ${marker}`);
    await page.getByPlaceholder("詳細描述...").fill(`內容 ${marker}`);
    await page.getByRole("button", { name: "建立" }).click();
    await expect(page.getByText(`指引 ${marker}`)).toBeVisible();

    const instructionRow = instructionsSection.locator("div", {
      has: page.getByText(`指引 ${marker}`),
    });
    await instructionRow.getByRole("button", { name: "編輯" }).click();
    await expect(page.getByText("編輯護理指引")).toBeVisible();
    await page
      .locator("textarea")
      .first()
      .fill(`內容 ${marker} updated`);
    await page.getByRole("button", { name: "儲存" }).click();
    await expect(page.getByText(`內容 ${marker} updated`)).toBeVisible();

    const followSection = page.locator("section", {
      has: page.getByRole("heading", { name: "覆診計劃" }),
    });
    await followSection.getByRole("button", { name: "+ 新增覆診" }).click();
    await expect(page.getByText("新增覆診計劃")).toBeVisible();

    const suggestedDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    await page.locator('input[type="date"]').first().fill(suggestedDate);
    await page.getByPlaceholder("例: 療程第二次覆診...").fill(`覆診 ${marker}`);
    await page.getByRole("button", { name: "建立" }).click();
    await expect(page.getByText(`覆診 ${marker}`)).toBeVisible();

    const followRow = followSection.locator("div", {
      has: page.getByText(`覆診 ${marker}`),
    });
    await followRow.getByRole("button", { name: "編輯" }).click();
    await expect(page.getByText("編輯覆診計劃")).toBeVisible();
    await page
      .locator("textarea")
      .first()
      .fill(`覆診 ${marker} updated`);
    await page.getByRole("button", { name: "儲存" }).click();
    await expect(page.getByText(`覆診 ${marker} updated`)).toBeVisible();
  } finally {
    await context.close();
  }
});
