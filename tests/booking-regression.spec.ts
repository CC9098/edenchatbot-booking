import { expect, test } from "@playwright/test";

const MOCK_EVENT_ID = "evt-regression-001";
const MOCK_CALENDAR_ID = "cal-regression-001";

const MOCK_BOOKING_EVENT = {
  summary: "中醫諮詢",
  description:
    "Doctor / 醫師: 陳家富醫師 (Dr. Chan)\nClinic / 診所: 中環 (Central)",
  start: {
    dateTime: "2026-03-10T03:00:00.000Z",
  },
};

test.describe("booking regression - /api/booking, /cancel, /reschedule", () => {
  test("POST /api/booking returns 400 for invalid payload", async ({ request }) => {
    const res = await request.post("/api/booking", {
      data: {},
    });

    expect(res.status()).toBe(400);
    const body = (await res.json()) as { error?: string; details?: unknown[] };
    expect(body.error).toBe("Invalid input");
    expect(Array.isArray(body.details)).toBeTruthy();
    expect((body.details || []).length).toBeGreaterThan(0);
  });

  test("GET and DELETE /api/booking return 400 when params are missing", async ({
    request,
  }) => {
    const getRes = await request.get("/api/booking");
    expect(getRes.status()).toBe(400);
    const getBody = (await getRes.json()) as { error?: string };
    expect(getBody.error).toContain("Missing eventId or calendarId");

    const deleteRes = await request.delete("/api/booking");
    expect(deleteRes.status()).toBe(400);
    const deleteBody = (await deleteRes.json()) as { error?: string };
    expect(deleteBody.error).toContain("Missing eventId or calendarId");
  });

  test("PATCH /api/booking returns 400 for invalid reschedule payload", async ({
    request,
  }) => {
    const res = await request.patch("/api/booking", {
      data: {
        eventId: MOCK_EVENT_ID,
        calendarId: MOCK_CALENDAR_ID,
        date: "2026/03/10",
        time: "11-00",
      },
    });

    expect(res.status()).toBe(400);
    const body = (await res.json()) as { error?: string; details?: unknown[] };
    expect(body.error).toBe("Invalid input");
    expect(Array.isArray(body.details)).toBeTruthy();
    expect((body.details || []).length).toBeGreaterThan(0);
  });

  test("cancel page - success path cancels booking and shows confirmation", async ({
    page,
  }) => {
    await page.route(
      `**/api/booking?eventId=${MOCK_EVENT_ID}&calendarId=${MOCK_CALENDAR_ID}`,
      async (route, request) => {
        if (request.method() === "GET") {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(MOCK_BOOKING_EVENT),
          });
          return;
        }

        if (request.method() === "DELETE") {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ success: true }),
          });
          return;
        }

        await route.fallback();
      }
    );

    await page.goto(
      `/cancel?eventId=${MOCK_EVENT_ID}&calendarId=${MOCK_CALENDAR_ID}`
    );

    await expect(page.getByRole("heading", { name: "取消預約" })).toBeVisible();
    await expect(page.getByText("11:00")).toBeVisible();
    await expect(page.getByRole("button", { name: "確認取消" })).toBeVisible();

    const cancelResponsePromise = page.waitForResponse(
      (res) =>
        res.url().includes("/api/booking") &&
        res.request().method() === "DELETE"
    );

    await page.getByRole("button", { name: "確認取消" }).click();
    const cancelRes = await cancelResponsePromise;
    expect(cancelRes.ok()).toBeTruthy();
    const cancelBody = (await cancelRes.json()) as { success?: boolean };
    expect(cancelBody.success).toBeTruthy();

    await expect(page.getByText("預約已取消")).toBeVisible();
  });

  test("cancel page - failure path handles invalid link and delete failure", async ({
    page,
  }) => {
    await page.goto("/cancel");
    await expect(page.getByText("預約連結無效")).toBeVisible();

    await page.route(
      `**/api/booking?eventId=${MOCK_EVENT_ID}&calendarId=${MOCK_CALENDAR_ID}`,
      async (route, request) => {
        if (request.method() === "GET") {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(MOCK_BOOKING_EVENT),
          });
          return;
        }

        if (request.method() === "DELETE") {
          await route.fulfill({
            status: 500,
            contentType: "application/json",
            body: JSON.stringify({ error: "Failed to cancel booking" }),
          });
          return;
        }

        await route.fallback();
      }
    );

    await page.goto(
      `/cancel?eventId=${MOCK_EVENT_ID}&calendarId=${MOCK_CALENDAR_ID}`
    );

    const failResponsePromise = page.waitForResponse(
      (res) =>
        res.url().includes("/api/booking") &&
        res.request().method() === "DELETE"
    );

    await page.getByRole("button", { name: "確認取消" }).click();
    const failRes = await failResponsePromise;
    expect(failRes.status()).toBe(500);
    const failBody = (await failRes.json()) as { error?: string };
    expect(failBody.error).toContain("Failed to cancel booking");

    await expect(page.getByText("取消預約失敗")).toBeVisible();
  });

  test("reschedule page - success path loads slots and updates booking", async ({
    page,
  }) => {
    await page.route(
      `**/api/booking?eventId=${MOCK_EVENT_ID}&calendarId=${MOCK_CALENDAR_ID}`,
      async (route, request) => {
        if (request.method() === "GET") {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(MOCK_BOOKING_EVENT),
          });
          return;
        }
        await route.fallback();
      }
    );

    await page.route("**/api/availability", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          slots: ["11:00", "11:15"],
        }),
      });
    });

    await page.route("**/api/booking", async (route, request) => {
      if (request.method() !== "PATCH") {
        await route.fallback();
        return;
      }

      const body = request.postDataJSON() as {
        eventId?: string;
        calendarId?: string;
        date?: string;
        time?: string;
      };
      expect(body.eventId).toBe(MOCK_EVENT_ID);
      expect(body.calendarId).toBe(MOCK_CALENDAR_ID);
      expect(typeof body.date).toBe("string");
      expect(body.time).toBe("11:00");

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    });

    await page.goto(
      `/reschedule?eventId=${MOCK_EVENT_ID}&calendarId=${MOCK_CALENDAR_ID}`
    );

    await expect(page.getByText("11:00")).toBeVisible();
    await page.getByRole("button", { name: "選擇新時段" }).click();
    await expect(page.getByRole("heading", { name: "選擇日期" })).toBeVisible();

    const dateGrid = page.locator("h3:has-text('選擇日期') + div");
    const [slotsResponse] = await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().includes("/api/availability") &&
          res.request().method() === "POST"
      ),
      dateGrid.locator("button").first().click(),
    ]);
    expect(slotsResponse.ok()).toBeTruthy();
    const slotsBody = (await slotsResponse.json()) as { slots?: string[] };
    expect(slotsBody.slots).toEqual(["11:00", "11:15"]);

    await page.getByRole("button", { name: "11:00" }).click();

    const patchResponsePromise = page.waitForResponse(
      (res) =>
        res.url().includes("/api/booking") &&
        res.request().method() === "PATCH"
    );
    await page.getByRole("button", { name: "確認更改" }).click();
    const patchRes = await patchResponsePromise;
    expect(patchRes.ok()).toBeTruthy();
    const patchBody = (await patchRes.json()) as { success?: boolean };
    expect(patchBody.success).toBeTruthy();

    await expect(page.getByText("改期成功！")).toBeVisible();
  });

  test("reschedule page - failure path handles invalid link and API 400", async ({
    page,
  }) => {
    await page.goto("/reschedule");
    await expect(page.getByText("預約連結無效")).toBeVisible();

    await page.route(
      `**/api/booking?eventId=${MOCK_EVENT_ID}&calendarId=${MOCK_CALENDAR_ID}`,
      async (route, request) => {
        if (request.method() === "GET") {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(MOCK_BOOKING_EVENT),
          });
          return;
        }
        await route.fallback();
      }
    );

    await page.route("**/api/availability", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          slots: ["11:00"],
        }),
      });
    });

    await page.route("**/api/booking", async (route, request) => {
      if (request.method() !== "PATCH") {
        await route.fallback();
        return;
      }

      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ error: "Invalid input" }),
      });
    });

    await page.goto(
      `/reschedule?eventId=${MOCK_EVENT_ID}&calendarId=${MOCK_CALENDAR_ID}`
    );
    await page.getByRole("button", { name: "選擇新時段" }).click();
    const dateGrid = page.locator("h3:has-text('選擇日期') + div");
    await dateGrid.locator("button").first().click();
    await page.getByRole("button", { name: "11:00" }).click();

    const failPatchPromise = page.waitForResponse(
      (res) =>
        res.url().includes("/api/booking") &&
        res.request().method() === "PATCH"
    );
    await page.getByRole("button", { name: "確認更改" }).click();
    const failPatch = await failPatchPromise;
    expect(failPatch.status()).toBe(400);
    const failBody = (await failPatch.json()) as { error?: string };
    expect(failBody.error).toBe("Invalid input");

    await expect(page.getByRole("heading", { name: "發生錯誤" })).toBeVisible();
    await expect(page.getByText("Invalid input")).toBeVisible();
  });
});
