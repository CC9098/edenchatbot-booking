import { NextResponse } from "next/server";
import { google } from "googleapis";
import { fromZonedTime } from "date-fns-tz";

import { AuthError, getCurrentUser, requireStaffRole } from "@/lib/auth-helpers";
import { getGoogleAuthClient } from "@/lib/google-auth";

export const dynamic = "force-dynamic";

const HONG_KONG_TIMEZONE = "Asia/Hong_Kong";
const DEFAULT_TARGET_CALENDAR_ID =
  "bb9e3b864e99dd1dda3e828e40f2545f245c8e2fd01bd459390c3409e46db4d3@group.calendar.google.com";

function safeError(error: unknown) {
  if (!error || typeof error !== "object") return { message: String(error) };
  const maybeError = error as {
    code?: unknown;
    message?: unknown;
    response?: { data?: unknown; status?: unknown };
  };

  return {
    code: maybeError.code,
    message: typeof maybeError.message === "string" ? maybeError.message : String(error),
    status: maybeError.response?.status,
    response: maybeError.response?.data,
  };
}

async function capture<T>(fn: () => Promise<T>) {
  try {
    return { ok: true as const, data: await fn() };
  } catch (error) {
    return { ok: false as const, error: safeError(error) };
  }
}

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const staffRole = await requireStaffRole(user.id);
    const url = new URL(request.url);
    const targetCalendarId =
      url.searchParams.get("calendarId")?.trim() || DEFAULT_TARGET_CALENDAR_ID;

    const auth = await getGoogleAuthClient();
    const calendar = google.calendar({ version: "v3", auth });
    const dayStart = fromZonedTime("2026-05-14T00:00:00", HONG_KONG_TIMEZONE);
    const dayEnd = fromZonedTime("2026-05-14T23:59:59", HONG_KONG_TIMEZONE);

    const primaryCalendar = await capture(async () => {
      const response = await calendar.calendars.get({ calendarId: "primary" });
      return {
        id: response.data.id,
        summary: response.data.summary,
        timeZone: response.data.timeZone,
      };
    });

    const targetCalendar = await capture(async () => {
      const response = await calendar.calendars.get({ calendarId: targetCalendarId });
      return {
        id: response.data.id,
        summary: response.data.summary,
        timeZone: response.data.timeZone,
      };
    });

    const targetCalendarListEntry = await capture(async () => {
      const response = await calendar.calendarList.get({ calendarId: targetCalendarId });
      return {
        id: response.data.id,
        summary: response.data.summary,
        accessRole: response.data.accessRole,
        selected: response.data.selected,
        hidden: response.data.hidden,
      };
    });

    const freeBusy = await capture(async () => {
      const response = await calendar.freebusy.query({
        requestBody: {
          timeMin: dayStart.toISOString(),
          timeMax: dayEnd.toISOString(),
          timeZone: HONG_KONG_TIMEZONE,
          items: [{ id: targetCalendarId }],
        },
      });
      return response.data.calendars?.[targetCalendarId] || null;
    });

    const visibleCalendarMatches = await capture(async () => {
      const response = await calendar.calendarList.list({ maxResults: 250 });
      return (response.data.items || [])
        .filter((item) => item.id === targetCalendarId || item.summary?.includes("黃浩哲"))
        .map((item) => ({
          id: item.id,
          summary: item.summary,
          accessRole: item.accessRole,
          selected: item.selected,
          hidden: item.hidden,
        }));
    });

    return NextResponse.json({
      staffUserId: user.id,
      staffRole: staffRole.role,
      targetCalendarId,
      primaryCalendar,
      targetCalendar,
      targetCalendarListEntry,
      freeBusy,
      visibleCalendarMatches,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("[GET /api/staff/google-calendar-debug] unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
