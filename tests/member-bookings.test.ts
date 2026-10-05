import test from "node:test";
import assert from "node:assert/strict";
import { getVerifiedMemberPhoneVariants, splitMemberBookings, type MemberBooking } from "@/lib/member-bookings";

test("booking phone access requires the Auth-confirmed phone", () => {
  assert.deepEqual(getVerifiedMemberPhoneVariants({ phone: "+85290000001", phone_confirmed_at: undefined }), []);
  assert.deepEqual(getVerifiedMemberPhoneVariants({ phone: "+85290000001", phone_confirmed_at: "2026-10-05" }), ["85290000001", "90000001"]);
  assert.deepEqual(getVerifiedMemberPhoneVariants({ phone: "+447000000001", phone_confirmed_at: "2026-10-05" }), ["447000000001"]);
});

test("upcoming and history use Hong Kong time, keeping cancelled future bookings in history", () => {
  const row = (id: string, date: string, time: string, status: MemberBooking["status"] = "confirmed"): MemberBooking => ({
    id, appointment_date: date, appointment_time: time, status,
    doctor_name_zh: "測試醫師", clinic_name_zh: "測試診所", patient_name: "測試病人",
  });
  const result = splitMemberBookings([
    row("past-today", "2026-10-06", "00:15"), row("next", "2026-10-06", "09:00"),
    row("cancelled", "2026-10-07", "09:00", "cancelled"), row("later", "2026-10-07", "10:00"),
  ], new Date("2026-10-05T16:30:00Z"));
  assert.deepEqual(result.upcoming.map((booking) => booking.id), ["next", "later"]);
  assert.deepEqual(result.history.map((booking) => booking.id), ["cancelled", "past-today"]);
});
