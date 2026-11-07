import assert from "node:assert/strict";
import test from "node:test";

import {
  buildBookingEventAttendees,
  extractFreeBusySlotsFromResponse,
} from "@/lib/google-calendar";
import { buildBookingEventSummary, hasTianJiuBookingLabel } from "@/lib/booking-calendar-labels";

test("booking titles show first visit and Tian Jiu tags directly before the patient name", () => {
  const booking = { doctorNameZh: "李醫師", clinicNameZh: "中環", patientName: "測試病人" };
  assert.equal(buildBookingEventSummary({
    ...booking,
    visitType: "first",
    isTianJiu: hasTianJiuBookingLabel("Booking source: Test | Treatments: Other (please specify): Tian Jiu | [First visit]"),
  }), "李醫師｜中環 - 【新症】【天灸】測試病人");
  assert.equal(buildBookingEventSummary({
    ...booking, visitType: "followup", isTianJiu: hasTianJiuBookingLabel("治療項目: 針灸 | 病人曾做天灸"),
  }), "李醫師｜中環 - 測試病人");
});

test("freebusy parser surfaces per-calendar access errors", () => {
  assert.throws(
    () =>
      extractFreeBusySlotsFromResponse(
        {
          calendars: {
            "missing-calendar@example.com": {
              errors: [{ domain: "global", reason: "notFound" }],
              busy: [],
            },
          },
        },
        "missing-calendar@example.com"
      ),
    /Calendar not found or no access \(notFound\)/
  );
});

test("freebusy parser returns busy slots for accessible calendars", () => {
  const slots = extractFreeBusySlotsFromResponse(
    {
      calendars: {
        "clinic-calendar@example.com": {
          busy: [
            {
              start: "2026-05-14T04:00:00.000Z",
              end: "2026-05-14T04:30:00.000Z",
            },
          ],
        },
      },
    },
    "clinic-calendar@example.com"
  );

  assert.equal(slots.length, 1);
  assert.equal(slots[0].start.toISOString(), "2026-05-14T04:00:00.000Z");
  assert.equal(slots[0].end.toISOString(), "2026-05-14T04:30:00.000Z");
});

test("Cheung Tin Wai online consultation invites the doctor into the Meet event", () => {
  assert.deepEqual(
    buildBookingEventAttendees({
      doctorId: "cheung",
      clinicId: "online",
      clinicNameZh: "網上",
    }),
    [{ email: "cheungtinw@gmail.com", displayName: "張天慧醫師" }]
  );
});

test("booking event attendees are only added for Cheung Tin Wai online consultation", () => {
  assert.equal(
    buildBookingEventAttendees({
      doctorId: "cheung",
      clinicId: "jordan",
      clinicNameZh: "佐敦",
    }),
    undefined
  );
  assert.equal(
    buildBookingEventAttendees({
      doctorId: "lee",
      clinicId: "online",
      clinicNameZh: "網上",
    }),
    undefined
  );
});
