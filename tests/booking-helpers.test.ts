import assert from "node:assert/strict";
import test from "node:test";

import { fromZonedTime } from "date-fns-tz";
import type { CalendarMapping, TimeRange } from '@/shared/schedule-config';

import {
  isLastClinicSessionBooking,
  isSlotAfterClinicLastBookingCutoffUtc,
  isSlotBlockedByOnlineSourceLastBookingCutoffUtc,
  isSlotBlockedBySameDayEveningCutoffUtc,
} from "@/lib/booking-helpers";


test("last in-person appointment follows dated hours and the doctor's cutoff", () => {
  const mapping: CalendarMapping = {
    doctorId: "lee",
    clinicId: "central",
    calendarId: "test-calendar",
    isActive: true,
    schedule: {
      1: [{ start: "11:00", end: "14:00" }, { start: "15:30", end: "19:00" }],
      6: [{ start: "14:30", end: "18:30" }],
    },
  };
  const monday = "2026-11-09";
  const saturday = "2026-11-14";
  assert.equal(isLastClinicSessionBooking(mapping, monday, "13:15", "13:30"), true);
  assert.equal(isLastClinicSessionBooking(mapping, monday, "13:00", "13:15"), false);
  assert.equal(isLastClinicSessionBooking(mapping, monday, "18:45", "19:00"), true);
  assert.equal(isLastClinicSessionBooking(mapping, monday, "18:15", "18:30"), false);
  assert.equal(isLastClinicSessionBooking({ ...mapping, clinicId: "tsuenwan" }, monday, "18:15", "18:30"), true);
  assert.equal(isLastClinicSessionBooking({ ...mapping, clinicId: "jordan" }, saturday, "17:45", "18:00"), true);
  assert.equal(isLastClinicSessionBooking({ ...mapping, clinicId: "jordan" }, saturday, "17:30", "17:45"), false);
  assert.equal(isLastClinicSessionBooking({ ...mapping, clinicId: "online" }, monday, "18:45", "19:00"), false);
  assert.equal(isLastClinicSessionBooking({ ...mapping, doctorId: "hon" }, monday, "13:15", "13:30"), false);
  assert.equal(isLastClinicSessionBooking({
    ...mapping, doctorId: "wong", schedule: { 1: [{ start: "15:00", end: "18:00" }] },
  }, monday, "17:15", "17:45"), false);
  assert.equal(isLastClinicSessionBooking({
    ...mapping, schedule: { 1: [{ start: "15:30", end: "17:00" }] },
  }, monday, "16:45", "17:00"), true);
});

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

  test(`${doctorId} keeps early afternoon sessions outside the lunch cutoff`, () => {
    assert.equal(isSlotAfterClinicLastBookingCutoffUtc(toUtc('2026-11-10', '14:30'), 'jordan', doctorId), false);
  });
}

test('Dr. Lee Saturday Jordan last booking is 17:45, with the morning and other days unchanged', () => {
  assert.equal(isSlotAfterClinicLastBookingCutoffUtc(toUtc('2026-11-07', '13:15'), 'jordan', 'lee'), false);
  assert.equal(isSlotAfterClinicLastBookingCutoffUtc(toUtc('2026-11-07', '13:30'), 'jordan', 'lee'), true);
  assert.equal(isSlotAfterClinicLastBookingCutoffUtc(toUtc('2026-11-07', '17:45'), 'jordan', 'lee'), false);
  for (const time of ['18:00', '18:15', '18:45']) {
    assert.equal(isSlotAfterClinicLastBookingCutoffUtc(toUtc('2026-11-07', time), 'jordan', 'lee'), true);
  }
  assert.equal(isSlotAfterClinicLastBookingCutoffUtc(toUtc('2026-11-06', '18:45'), 'jordan', 'lee'), false);
  assert.equal(isSlotAfterClinicLastBookingCutoffUtc(toUtc('2026-11-07', '18:45'), 'central', 'lee'), false);
  assert.equal(isSlotAfterClinicLastBookingCutoffUtc(toUtc('2026-11-07', '18:45'), 'jordan', 'chau'), false);
});

function sourceMapping(
  doctorId: CalendarMapping['doctorId'],
  clinicId: CalendarMapping['clinicId'],
  day: number,
  ranges: TimeRange[]
): CalendarMapping {
  return { doctorId, clinicId, calendarId: 'synthetic-source-calendar', isActive: true, schedule: { [day]: ranges } };
}

for (const doctorId of ['lee', 'chau'] as const) {
  test(`${doctorId} online appointments inherit the physical source clinic's inclusive cutoffs`, () => {
    for (const clinicId of ['central', 'jordan', 'tsuenwan'] as const) {
      const mappings = [sourceMapping(doctorId, clinicId, 4, [
        { start: '10:30', end: '14:00' }, { start: '15:30', end: '19:30' },
      ])];
      for (const [time, blocked] of [['13:15', false], ['13:30', true],
        [clinicId === 'tsuenwan' ? '18:15' : '18:45', false],
        [clinicId === 'tsuenwan' ? '18:30' : '19:00', true]] as const) {
        assert.equal(isSlotBlockedByOnlineSourceLastBookingCutoffUtc(toUtc('2026-11-12', time), doctorId, mappings), blocked, `${clinicId}/${time}`);
      }
    }
  });
}

test('online cutoffs follow the relevant session when the doctor changes clinics during the day', () => {
  const mappings = [
    sourceMapping('lee', 'jordan', 1, [{ start: '11:00', end: '14:00' }]),
    sourceMapping('lee', 'tsuenwan', 1, [{ start: '15:30', end: '19:00' }]),
    sourceMapping('lee', 'central', 2, [{ start: '15:30', end: '19:30' }]),
    sourceMapping('chau', 'central', 1, [{ start: '15:30', end: '19:30' }]),
  ];
  assert.equal(isSlotBlockedByOnlineSourceLastBookingCutoffUtc(toUtc('2026-11-09', '13:15'), 'lee', mappings), false);
  assert.equal(isSlotBlockedByOnlineSourceLastBookingCutoffUtc(toUtc('2026-11-09', '13:30'), 'lee', mappings), true);
  assert.equal(isSlotBlockedByOnlineSourceLastBookingCutoffUtc(toUtc('2026-11-09', '18:15'), 'lee', mappings), false);
  assert.equal(isSlotBlockedByOnlineSourceLastBookingCutoffUtc(toUtc('2026-11-09', '18:30'), 'lee', mappings), true);
});

test('Dr. Lee Saturday online appointments also stop at 17:45', () => {
  const mappings = [sourceMapping('lee', 'jordan', 6, [
    { start: '11:00', end: '14:00' }, { start: '15:30', end: '18:30' },
  ])];
  assert.equal(isSlotBlockedByOnlineSourceLastBookingCutoffUtc(toUtc('2026-11-07', '17:45'), 'lee', mappings), false);
  assert.equal(isSlotBlockedByOnlineSourceLastBookingCutoffUtc(toUtc('2026-11-07', '18:00'), 'lee', mappings), true);
  assert.equal(isSlotBlockedByOnlineSourceLastBookingCutoffUtc(toUtc('2026-11-07', '13:30'), 'lee', mappings), true);
});

test('online appointments for other practitioners retain their existing schedules', () => {
  const mappings = [sourceMapping('hon', 'central', 4, [{ start: '15:30', end: '19:30' }])];
  assert.equal(isSlotBlockedByOnlineSourceLastBookingCutoffUtc(toUtc('2026-11-12', '19:15'), 'hon', mappings), false);
  assert.equal(isSlotBlockedByOnlineSourceLastBookingCutoffUtc(toUtc('2026-11-12', '23:10'), 'cheung', []), false);
});

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
