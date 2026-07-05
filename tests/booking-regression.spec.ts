import { expect, test } from "@playwright/test";

const RETIRED_BOOKING_MESSAGE =
  "此服務已更新，請經 /manage-booking 管理預約";

test.describe("retired booking self-management surfaces", () => {
  test("POST and PATCH /api/booking return 410", async ({ request }) => {
    const postRes = await request.post("/api/booking", {
      data: {},
    });
    expect(postRes.status()).toBe(410);
    await expectRetiredBookingResponse(postRes);

    const patchRes = await request.patch("/api/booking", {
      data: {},
    });
    expect(patchRes.status()).toBe(410);
    await expectRetiredBookingResponse(patchRes);
  });

  test("legacy /reschedule links redirect to manage-booking reschedule flow", async ({
    page,
  }) => {
    await page.goto("/reschedule?eventId=evt-old&calendarId=cal-old");

    await expect(page).toHaveURL(/\/manage-booking\?action=reschedule$/);
  });

  test("legacy /reschedule links preserve token when present", async ({
    page,
  }) => {
    await page.goto("/reschedule?token=tok-old&eventId=evt-old");

    await expect(page).toHaveURL(
      /\/manage-booking\?action=reschedule&token=tok-old$/,
    );
  });

  test("legacy /cancel links redirect to manage-booking cancel flow", async ({
    page,
  }) => {
    await page.goto("/cancel?eventId=evt-old&calendarId=cal-old");

    await expect(page).toHaveURL(/\/manage-booking\?action=cancel$/);
  });

  test("legacy /cancel links preserve token when present", async ({ page }) => {
    await page.goto("/cancel?token=tok-old&eventId=evt-old");

    await expect(page).toHaveURL(
      /\/manage-booking\?action=cancel&token=tok-old$/,
    );
  });
});

async function expectRetiredBookingResponse(response: {
  json(): Promise<unknown>;
}) {
  expect(await response.json()).toEqual({ error: RETIRED_BOOKING_MESSAGE });
}
