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

for (const doctorId of ['lee', 'chau']) {
  test(`${doctorId} allows 13:15 and blocks later morning slots at every physical clinic`, () => {
    for (const clinicId of ['central', 'jordan', 'tsuenwan']) {
      assert.equal(isSlotAfterClinicLastBookingCutoffUtc(toUtc('2026-11-10', '13:15'), clinicId, doctorId), false);
      assert.equal(isSlotAfterClinicLastBookingCutoffUtc(toUtc('2026-11-10', '13:30'), clinicId, doctorId), true);
      assert.equal(isSlotAfterClinicLastBookingCutoffUtc(toUtc('2026-11-10', '13:45'), clinicId, doctorId), true);
    }
  });

  test(`${doctorId} uses 18:45 at Central/Jordan and 18:15 at Tsuen Wan`, () => {
    for (const clinicId of ['central', 'jordan']) {
      assert.equal(isSlotAfterClinicLastBookingCutoffUtc(toUtc('2026-11-10', '18:45'), clinicId, doctorId), false);
      assert.equal(isSlotAfterClinicLastBookingCutoffUtc(toUtc('2026-11-10', '19:00'), clinicId, doctorId), true);
    }
    assert.equal(isSlotAfterClinicLastBookingCutoffUtc(toUtc('2026-11-10', '18:15'), 'tsuenwan', doctorId), false);
    assert.equal(isSlotAfterClinicLastBookingCutoffUtc(toUtc('2026-11-10', '18:30'), 'tsuenwan', doctorId), true);
  });

  test(`${doctorId} keeps online slots and early afternoon sessions outside the lunch cutoff`, () => {
    assert.equal(isSlotAfterClinicLastBookingCutoffUtc(toUtc('2026-11-10', '19:15'), 'online', doctorId), false);
    assert.equal(isSlotAfterClinicLastBookingCutoffUtc(toUtc('2026-11-10', '14:30'), 'jordan', doctorId), false);
  });
}

test('other practitioners keep their scheduled morning and evening slots', () => {
  for (const doctorId of ['chan', 'hon', 'cheung', 'cheungmy', 'leung', 'wong']) {
    for (const clinicId of ['central', 'jordan', 'tsuenwan']) {
      for (const time of ['13:30', '13:45', '14:30', '18:30', '18:45', '19:00', '19:15']) {
        assert.equal(isSlotAfterClinicLastBookingCutoffUtc(toUtc('2026-11-10', time), clinicId, doctorId), false, `${doctorId}/${clinicId}/${time}`);
      }
    }
  }
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
