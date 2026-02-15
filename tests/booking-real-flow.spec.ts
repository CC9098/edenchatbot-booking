import {
  expect,
  request,
  test,
  type APIRequestContext,
} from "@playwright/test";
import { z } from "zod";
import { createAuthenticatedApiContext } from "./helpers/auth";
import { getBaseUrl, getMissingRoleEnvVars } from "./helpers/env";
import {
  CLINIC_BY_ID,
  DOCTOR_BY_ID,
  isClinicId,
  isDoctorId,
  type ClinicId,
  type DoctorId,
} from "../shared/clinic-data";
import { CALENDAR_MAPPINGS } from "../shared/schedule-config";

type Candidate = {
  doctorId: DoctorId;
  clinicId: ClinicId;
  calendarId: string;
  doctorName: string;
  doctorNameZh: string;
  clinicName: string;
  clinicNameZh: string;
};

type FlowSlots = {
  candidate: Candidate;
  createDate: string;
  createTime: string;
  rescheduleDate: string;
  rescheduleTime: string;
};

const HONG_KONG_TIMEZONE = "Asia/Hong_Kong";
const RUN_REAL_BOOKING = process.env.RUN_REAL_BOOKING === "1";
const DURATION_MINUTES = Number(process.env.E2E_BOOKING_DURATION_MINUTES || "15");
const SEARCH_MAX_DAYS = Number(process.env.E2E_BOOKING_SEARCH_DAYS || "10");
const API_TIMEOUT_MS = Number(process.env.E2E_BOOKING_API_TIMEOUT_MS || "45000");

const availabilityRequestSchema = z
  .object({
    doctorId: z.string(),
    clinicId: z.string(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    durationMinutes: z.number().int().positive(),
  })
  .strict();

const createRequestSchema = z
  .object({
    doctorId: z.string(),
    doctorName: z.string(),
    doctorNameZh: z.string(),
    clinicId: z.string(),
    clinicName: z.string(),
    clinicNameZh: z.string(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    time: z.string().regex(/^\d{2}:\d{2}$/),
    durationMinutes: z.number().int().positive(),
    patientName: z.string().min(2),
    phone: z.string().min(8),
    email: z.string().email(),
    notes: z.string().optional(),
  })
  .strict();

const rescheduleRequestSchema = z
  .object({
    eventId: z.string().min(1),
    calendarId: z.string().min(1),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    time: z.string().regex(/^\d{2}:\d{2}$/),
    durationMinutes: z.number().int().positive(),
  })
  .strict();

const cancelRequestSchema = z
  .object({
    eventId: z.string().min(1),
    calendarId: z.string().min(1),
  })
  .strict();

const availabilityResponseSchema = z.object({
  success: z.boolean().optional(),
  slots: z.array(z.string()).optional(),
  isClosed: z.boolean().optional(),
  isHoliday: z.boolean().optional(),
  error: z.string().optional(),
});

function formatYyyyMmDdInHk(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: HONG_KONG_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;

  if (!y || !m || !d) {
    throw new Error("Failed to format date in Asia/Hong_Kong timezone.");
  }

  return `${y}-${m}-${d}`;
}

function buildCandidateMappings(): Candidate[] {
  const envDoctorId = process.env.E2E_BOOKING_DOCTOR_ID;
  const envClinicId = process.env.E2E_BOOKING_CLINIC_ID;

  if (envDoctorId && !isDoctorId(envDoctorId)) {
    throw new Error(`Invalid E2E_BOOKING_DOCTOR_ID: ${envDoctorId}`);
  }

  if (envClinicId && !isClinicId(envClinicId)) {
    throw new Error(`Invalid E2E_BOOKING_CLINIC_ID: ${envClinicId}`);
  }

  const candidates = CALENDAR_MAPPINGS.filter((mapping) => {
    if (!mapping.isActive) return false;
    if (mapping.clinicId === "online") return false;
    if (envDoctorId && mapping.doctorId !== envDoctorId) return false;
    if (envClinicId && mapping.clinicId !== envClinicId) return false;
    return true;
  }).map((mapping) => {
    const doctor = DOCTOR_BY_ID[mapping.doctorId];
    const clinic = CLINIC_BY_ID[mapping.clinicId];

    return {
      doctorId: mapping.doctorId,
      clinicId: mapping.clinicId,
      calendarId: mapping.calendarId,
      doctorName: doctor?.nameEn || mapping.doctorId,
      doctorNameZh: doctor?.nameZh || mapping.doctorId,
      clinicName: clinic?.nameEn || mapping.clinicId,
      clinicNameZh: clinic?.nameZh || mapping.clinicId,
    };
  });

  if (candidates.length === 0) {
    throw new Error(
      "No active physical doctor/clinic mapping found. Check E2E_BOOKING_DOCTOR_ID / E2E_BOOKING_CLINIC_ID."
    );
  }

  return candidates;
}

async function fetchAvailability(
  api: APIRequestContext,
  candidate: Candidate,
  date: string,
  durationMinutes: number
): Promise<string[]> {
  const payload = {
    doctorId: candidate.doctorId,
    clinicId: candidate.clinicId,
    date,
    durationMinutes,
  };

  availabilityRequestSchema.parse(payload);

  const response = await api.post("/api/chat/booking/availability", {
    data: payload,
    timeout: API_TIMEOUT_MS,
  });

  const json = (await response.json()) as unknown;
  const parsed = availabilityResponseSchema.safeParse(json);

  if (!parsed.success) {
    throw new Error(
      `Availability response schema mismatch (${candidate.doctorId}/${candidate.clinicId} ${date}): ${JSON.stringify(json).slice(0, 500)}`
    );
  }

  if (!response.ok()) {
    const message =
      parsed.data.error || JSON.stringify(parsed.data).slice(0, 300);
    throw new Error(
      `Availability request failed (${response.status()}) for ${candidate.doctorId}/${candidate.clinicId} ${date}: ${message}`
    );
  }

  return parsed.data.slots || [];
}

async function findBookAndRescheduleSlots(
  api: APIRequestContext,
  candidates: Candidate[],
  durationMinutes: number,
  searchDays: number
): Promise<FlowSlots> {
  const now = new Date();

  for (const candidate of candidates) {
    for (let offset = 1; offset <= searchDays; offset += 1) {
      const date = formatYyyyMmDdInHk(
        new Date(now.getTime() + offset * 24 * 60 * 60 * 1000)
      );
      const slots = await fetchAvailability(api, candidate, date, durationMinutes);

      if (slots.length === 0) {
        continue;
      }

      const createTime = slots[0];
      let rescheduleDate = date;
      let rescheduleTime = slots.find((slot) => slot !== createTime) || "";

      if (!rescheduleTime) {
        for (let rescheduleOffset = offset + 1; rescheduleOffset <= searchDays; rescheduleOffset += 1) {
          const nextDate = formatYyyyMmDdInHk(
            new Date(now.getTime() + rescheduleOffset * 24 * 60 * 60 * 1000)
          );
          const nextSlots = await fetchAvailability(
            api,
            candidate,
            nextDate,
            durationMinutes
          );

          if (nextSlots.length > 0) {
            rescheduleDate = nextDate;
            rescheduleTime = nextSlots[0];
            break;
          }
        }
      }

      if (!rescheduleTime) {
        continue;
      }

      return {
        candidate,
        createDate: date,
        createTime,
        rescheduleDate,
        rescheduleTime,
      };
    }
  }

  throw new Error(
    `No usable slot pair found within ${searchDays} days. Try increasing E2E_BOOKING_SEARCH_DAYS or overriding E2E_BOOKING_DOCTOR_ID/E2E_BOOKING_CLINIC_ID.`
  );
}

test.describe("B-mode booking real flow", () => {
  test("availability -> create -> reschedule -> cancel", async () => {
    test.setTimeout(300_000);
    const missing = RUN_REAL_BOOKING ? getMissingRoleEnvVars(["patient"]) : [];
    test.skip(
      missing.length > 0,
      `RUN_REAL_BOOKING=1 requires env: ${missing.join(", ")}`
    );

    const mode = RUN_REAL_BOOKING ? "RUN_REAL_BOOKING" : "DRY_RUN";
    const api = RUN_REAL_BOOKING
      ? await createAuthenticatedApiContext("patient")
      : await request.newContext({
          baseURL: getBaseUrl(),
        });

    try {
      expect(Number.isInteger(DURATION_MINUTES) && DURATION_MINUTES > 0).toBeTruthy();
      expect(Number.isInteger(SEARCH_MAX_DAYS) && SEARCH_MAX_DAYS > 0).toBeTruthy();

      const candidates = buildCandidateMappings();
      const slotPlan = await findBookAndRescheduleSlots(
        api,
        candidates,
        DURATION_MINUTES,
        SEARCH_MAX_DAYS
      );

      const patientName = process.env.E2E_BOOKING_PATIENT_NAME || "E2E Booking Flow";
      const phone = process.env.E2E_BOOKING_PHONE || "91234567";
      const email =
        process.env.E2E_BOOKING_EMAIL ||
        process.env.E2E_PATIENT_EMAIL ||
        "e2e+booking@example.com";
      const notes = process.env.E2E_BOOKING_NOTES || `playwright-${Date.now()}`;

      const createPayload = {
        doctorId: slotPlan.candidate.doctorId,
        doctorName: slotPlan.candidate.doctorName,
        doctorNameZh: slotPlan.candidate.doctorNameZh,
        clinicId: slotPlan.candidate.clinicId,
        clinicName: slotPlan.candidate.clinicName,
        clinicNameZh: slotPlan.candidate.clinicNameZh,
        date: slotPlan.createDate,
        time: slotPlan.createTime,
        durationMinutes: DURATION_MINUTES,
        patientName,
        phone,
        email,
        notes,
      };

      createRequestSchema.parse(createPayload);

      console.log(
        `[booking-real-flow] mode=${mode} candidate=${slotPlan.candidate.doctorId}/${slotPlan.candidate.clinicId} create=${slotPlan.createDate} ${slotPlan.createTime} reschedule=${slotPlan.rescheduleDate} ${slotPlan.rescheduleTime}`
      );

      if (!RUN_REAL_BOOKING) {
        const dryEventId = `dry-run-${Date.now()}`;

        const reschedulePayload = {
          eventId: dryEventId,
          calendarId: slotPlan.candidate.calendarId,
          date: slotPlan.rescheduleDate,
          time: slotPlan.rescheduleTime,
          durationMinutes: DURATION_MINUTES,
        };

        const cancelPayload = {
          eventId: dryEventId,
          calendarId: slotPlan.candidate.calendarId,
        };

        rescheduleRequestSchema.parse(reschedulePayload);
        cancelRequestSchema.parse(cancelPayload);

        console.log(
          `[booking-real-flow] DRY_RUN PASS payload validation complete. rerun=RUN_REAL_BOOKING=1 npx playwright test tests/booking-real-flow.spec.ts --project=chromium --workers=1`
        );
        return;
      }

      const createResponse = await api.post("/api/chat/booking/create", {
        data: createPayload,
        timeout: API_TIMEOUT_MS,
      });
      const createJson = (await createResponse.json()) as {
        success?: boolean;
        bookingId?: string;
        error?: string;
      };

      expect(
        createResponse.ok(),
        `create failed (${createResponse.status()}): ${JSON.stringify(createJson).slice(0, 600)}`
      ).toBeTruthy();
      expect(createJson.success).toBeTruthy();
      expect(typeof createJson.bookingId === "string" && createJson.bookingId.length > 0).toBeTruthy();

      const bookingId = createJson.bookingId as string;

      const reschedulePayload = {
        eventId: bookingId,
        calendarId: slotPlan.candidate.calendarId,
        date: slotPlan.rescheduleDate,
        time: slotPlan.rescheduleTime,
        durationMinutes: DURATION_MINUTES,
      };
      rescheduleRequestSchema.parse(reschedulePayload);

      const rescheduleResponse = await api.post("/api/chat/booking/reschedule", {
        data: reschedulePayload,
        timeout: API_TIMEOUT_MS,
      });
      const rescheduleJson = (await rescheduleResponse.json()) as {
        success?: boolean;
        error?: string;
      };

      expect(
        rescheduleResponse.ok(),
        `reschedule failed (${rescheduleResponse.status()}): ${JSON.stringify(rescheduleJson).slice(0, 600)}`
      ).toBeTruthy();
      expect(rescheduleJson.success).toBeTruthy();

      const cancelPayload = {
        eventId: bookingId,
        calendarId: slotPlan.candidate.calendarId,
      };
      cancelRequestSchema.parse(cancelPayload);

      const cancelResponse = await api.post("/api/chat/booking/cancel", {
        data: cancelPayload,
        timeout: API_TIMEOUT_MS,
      });
      const cancelJson = (await cancelResponse.json()) as {
        success?: boolean;
        error?: string;
      };

      expect(
        cancelResponse.ok(),
        `cancel failed (${cancelResponse.status()}): ${JSON.stringify(cancelJson).slice(0, 600)}`
      ).toBeTruthy();
      expect(cancelJson.success).toBeTruthy();

      console.log(
        `[booking-real-flow] RUN_REAL_BOOKING PASS bookingId=${bookingId} rerun=RUN_REAL_BOOKING=1 npx playwright test tests/booking-real-flow.spec.ts --project=chromium --workers=1`
      );
    } finally {
      await api.dispose();
    }
  });
});
