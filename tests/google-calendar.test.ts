import assert from "node:assert/strict";
import test from "node:test";

import {
  buildBookingEventAttendees,
  extractFreeBusySlotsFromResponse,
} from "@/lib/google-calendar";

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
