import assert from "node:assert/strict";
import test from "node:test";

import { fromZonedTime } from "date-fns-tz";

import {
  isSlotAfterClinicLastBookingCutoffUtc,
  isSlotBlockedBySameDayEveningCutoffUtc,
} from "@/lib/booking-helpers";

const HONG_KONG_TIMEZONE = "Asia/Hong_Kong";

function toUtc(date: string, time: string) {
  return fromZonedTime(`${date}T${time}:00`, HONG_KONG_TIMEZONE);
}

test("central and jordan allow 13:15 lunch slots but block anything later", () => {
  assert.equal(
    isSlotAfterClinicLastBookingCutoffUtc(toUtc("2026-03-30", "13:15"), "central"),
    false
  );
  assert.equal(
    isSlotAfterClinicLastBookingCutoffUtc(toUtc("2026-03-30", "13:30"), "central"),
    true
  );
  assert.equal(
    isSlotAfterClinicLastBookingCutoffUtc(toUtc("2026-03-30", "13:15"), "jordan"),
    false
  );
  assert.equal(
    isSlotAfterClinicLastBookingCutoffUtc(toUtc("2026-03-30", "13:30"), "jordan"),
    true
  );
});

test("tsuen wan and central use different evening last booking cutoffs", () => {
  assert.equal(
    isSlotAfterClinicLastBookingCutoffUtc(toUtc("2026-03-30", "18:15"), "tsuenwan"),
    false
  );
  assert.equal(
    isSlotAfterClinicLastBookingCutoffUtc(toUtc("2026-03-30", "18:30"), "tsuenwan"),
    true
  );
  assert.equal(
    isSlotAfterClinicLastBookingCutoffUtc(toUtc("2026-03-30", "18:45"), "central"),
    false
  );
  assert.equal(
    isSlotAfterClinicLastBookingCutoffUtc(toUtc("2026-03-30", "19:00"), "central"),
    true
  );
});

test("online bookings are not constrained by physical clinic last booking cutoffs", () => {
  assert.equal(
    isSlotAfterClinicLastBookingCutoffUtc(toUtc("2026-03-30", "19:15"), "online"),
    false
  );
});

test("same-day evening slots are blocked once Hong Kong time reaches 19:00", () => {
  assert.equal(
    isSlotBlockedBySameDayEveningCutoffUtc(
      toUtc("2026-05-07", "21:30"),
      toUtc("2026-05-07", "19:00")
    ),
    true
  );
  assert.equal(
    isSlotBlockedBySameDayEveningCutoffUtc(
      toUtc("2026-05-07", "18:45"),
      toUtc("2026-05-07", "19:00")
    ),
    false
  );
  assert.equal(
    isSlotBlockedBySameDayEveningCutoffUtc(
      toUtc("2026-05-07", "21:30"),
      toUtc("2026-05-07", "18:59")
    ),
    false
  );
  assert.equal(
    isSlotBlockedBySameDayEveningCutoffUtc(
      toUtc("2026-05-08", "21:30"),
      toUtc("2026-05-07", "19:30")
    ),
    false
  );
});
