import assert from "node:assert/strict";
import test from "node:test";

import {
  LOOK_BUSY_CONFIG,
  applyLookBusy,
  computeOccupancy,
  getHideRatio,
  getHideRatioForOccupancy,
  isLookBusyGloballyEnabled,
  isWithinNearDateRelease,
  stableHash,
  type LookBusyGridSlot,
  type LookBusyInput,
} from "@/lib/look-busy";
import { hasSupabaseAuthCookie, isVerifiedStaffViewer, shouldApplyLookBusy } from "@/lib/look-busy-viewer";
import { isDoctorLookBusyEnabled } from "@/shared/clinic-data";

// 2026-10-24 12:00 HK (Saturday). Far date = 2026-10-30 (Friday, no weekday cap).
const NOW = new Date("2026-10-24T04:00:00Z");
const FAR_DATE = "2026-10-30";

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function timesBetween(start: string, end: string, step: number): string[] {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const result: string[] = [];
  for (let minute = sh * 60 + sm; minute + step <= eh * 60 + em; minute += step) {
    result.push(`${pad(Math.floor(minute / 60))}:${pad(minute % 60)}`);
  }
  return result;
}

/** Two sessions: 10:00-14:00 and 15:00-19:00, 15-min slots = 16 + 16 = 32 slots. */
function buildDay(busyTimes: string[] = [], step = 15) {
  const busy = new Set(busyTimes);
  const grid: LookBusyGridSlot[] = [
    ...timesBetween("10:00", "14:00", step).map((time) => ({ time, session: 0, status: busy.has(time) ? "busy" : "free" } as LookBusyGridSlot)),
    ...timesBetween("15:00", "19:00", step).map((time) => ({ time, session: 1, status: busy.has(time) ? "busy" : "free" } as LookBusyGridSlot)),
  ];
  const offeredSlots = grid.filter((slot) => slot.status === "free").map((slot) => slot.time);
  return { grid, offeredSlots };
}

function input(overrides: Partial<LookBusyInput> & Pick<LookBusyInput, "grid" | "offeredSlots">): LookBusyInput {
  return {
    doctorId: "chan",
    clinicId: "central",
    date: FAR_DATE,
    slotMinutes: 15,
    now: NOW,
    enabled: true,
    ...overrides,
  };
}

test("config values match the approved rule", () => {
  assert.deepEqual(LOOK_BUSY_CONFIG.tiers, [
    { belowOccupancy: 0.3, hideRatio: 0.3 },
    { belowOccupancy: 0.6, hideRatio: 0.15 },
  ]);
  assert.equal(LOOK_BUSY_CONFIG.minVisiblePerSession, 5);
  assert.equal(LOOK_BUSY_CONFIG.releaseWithinDays, 2);
  assert.deepEqual(LOOK_BUSY_CONFIG.maxHideRatioByWeekday, { 6: 0.15 });
  assert.equal(getHideRatioForOccupancy(0), 0.3);
  assert.equal(getHideRatioForOccupancy(0.2999), 0.3);
  assert.equal(getHideRatioForOccupancy(0.3), 0.15);
  assert.equal(getHideRatioForOccupancy(0.5999), 0.15);
  assert.equal(getHideRatioForOccupancy(0.6), 0);
  assert.equal(getHideRatioForOccupancy(1), 0);
});

test("quiet day (occupancy < 30%) hides ~30% of free slots", () => {
  const day = buildDay(["10:00", "15:00"]); // 2/32 busy
  const result = applyLookBusy(input(day));
  assert.equal(day.offeredSlots.length, 30);
  assert.equal(result.hideRatio, 0.3);
  assert.equal(result.hiddenSlots.length, 9);
  assert.equal(result.visibleSlots.length, 21);
});

test("medium day (30% <= occupancy < 60%) hides ~15%", () => {
  const busy = timesBetween("10:00", "12:00", 15).concat(timesBetween("15:00", "16:15", 15)); // 8 + 5 = 13/32
  const day = buildDay(busy);
  const result = applyLookBusy(input(day));
  assert.ok(result.occupancy! >= 0.3 && result.occupancy! < 0.6);
  assert.equal(day.offeredSlots.length, 19);
  assert.equal(result.hiddenSlots.length, Math.round(19 * 0.15));
});

test("busy day (occupancy >= 60%) hides nothing", () => {
  const busy = timesBetween("10:00", "14:00", 15).concat(timesBetween("15:00", "17:00", 15)); // 24/32
  const day = buildDay(busy);
  const result = applyLookBusy(input(day));
  assert.equal(result.skipped, "busy_day");
  assert.deepEqual(result.visibleSlots, day.offeredSlots);
});

test("each session keeps at least min(5, offered) visible", () => {
  // Session 0: only 6 free; session 1: fully free. Occupancy 10/32 -> 20% tier.
  const busy = timesBetween("10:00", "12:30", 15); // 10 busy, 6 free in session 0
  const day = buildDay(busy);
  const result = applyLookBusy(input(day));
  const visibleSession0 = result.visibleSlots.filter((time) => time < "14:00");
  assert.ok(visibleSession0.length >= 5);

  // Tiny session with 3 free slots keeps all 3.
  const tiny: LookBusyGridSlot[] = timesBetween("10:00", "10:45", 15).map((time) => ({ time, session: 0, status: "free" }));
  const tinyResult = applyLookBusy(input({ grid: tiny, offeredSlots: tiny.map((slot) => slot.time) }));
  assert.equal(tinyResult.visibleSlots.length, 3);
});

test("floor can cap the total hidden below the target ratio", () => {
  const grid: LookBusyGridSlot[] = timesBetween("10:00", "11:45", 15).map((time) => ({ time, session: 0, status: "free" }));
  const result = applyLookBusy(input({ grid, offeredSlots: grid.map((slot) => slot.time) }));
  assert.equal(grid.length, 7);
  assert.equal(result.visibleSlots.length, 5); // target round(7*0.3)=2, floor allows 2
});

test("near-date release: today and the next two days (HK) show everything", () => {
  const day = buildDay();
  assert.equal(applyLookBusy(input({ ...day, date: "2026-10-24" })).skipped, "near_date");
  assert.equal(applyLookBusy(input({ ...day, date: "2026-10-25" })).skipped, "near_date");
  assert.equal(applyLookBusy(input({ ...day, date: "2026-10-26" })).skipped, "near_date");
  assert.notEqual(applyLookBusy(input({ ...day, date: "2026-10-27" })).skipped, "near_date");
  // 23:30 HK on 10-24 is still 10-24 in HK; 00:30 HK on 10-25 releases 10-27.
  assert.equal(isWithinNearDateRelease("2026-10-27", new Date("2026-10-24T16:30:00Z")), true);
  assert.equal(isWithinNearDateRelease("2026-10-27", new Date("2026-10-24T15:30:00Z")), false);
});

test("deterministic: same input gives same hidden set; order of calls irrelevant", () => {
  const day = buildDay(["11:00"]);
  const first = applyLookBusy(input(day));
  applyLookBusy(input({ ...day, date: "2026-11-02" }));
  const second = applyLookBusy(input(day));
  assert.deepEqual(first.hiddenSlots, second.hiddenSlots);
  assert.equal(stableHash("chan|central|2026-10-31|10:00"), stableHash("chan|central|2026-10-31|10:00"));
});

test("different doctor/date produce different hidden patterns", () => {
  const day = buildDay();
  const a = applyLookBusy(input(day)).hiddenSlots.join(",");
  const b = applyLookBusy(input({ ...day, doctorId: "lee" })).hiddenSlots.join(",");
  const c = applyLookBusy(input({ ...day, date: "2026-11-03" })).hiddenSlots.join(",");
  assert.ok(a !== b || a !== c);
});

test("prefers keeping slots adjacent to busy time and hides isolated slots", () => {
  const busy = ["11:00", "16:00"];
  const day = buildDay(busy);
  const result = applyLookBusy(input(day));
  const adjacent = ["10:45", "11:15", "15:45", "16:15"];
  for (const time of adjacent) {
    assert.ok(result.visibleSlots.includes(time), `${time} should stay visible`);
  }
  // all hidden slots are isolated (enough isolated slots exist to fill the target)
  for (const time of result.hiddenSlots) {
    assert.ok(!adjacent.includes(time));
  }
});

test("disabled input (global/doctor/staff) shows everything", () => {
  const day = buildDay();
  const result = applyLookBusy(input({ ...day, enabled: false }));
  assert.equal(result.skipped, "disabled");
  assert.deepEqual(result.visibleSlots, day.offeredSlots);
});

test("partial-day holiday slots are excluded from occupancy", () => {
  const grid: LookBusyGridSlot[] = [
    { time: "10:00", session: 0, status: "busy" },
    { time: "10:15", session: 0, status: "excluded" },
    { time: "10:30", session: 0, status: "free" },
  ];
  assert.equal(computeOccupancy(grid), 0.5);
  assert.equal(computeOccupancy([]), null);
});

test("global kill switch: unset/empty = on; false/0/off = off", () => {
  assert.equal(isLookBusyGloballyEnabled({}), true);
  assert.equal(isLookBusyGloballyEnabled({ LOOK_BUSY_ENABLED: "" }), true);
  assert.equal(isLookBusyGloballyEnabled({ LOOK_BUSY_ENABLED: "true" }), true);
  assert.equal(isLookBusyGloballyEnabled({ LOOK_BUSY_ENABLED: "false" }), false);
  assert.equal(isLookBusyGloballyEnabled({ LOOK_BUSY_ENABLED: "0" }), false);
  assert.equal(isLookBusyGloballyEnabled({ LOOK_BUSY_ENABLED: " OFF " }), false);
});

test("per-doctor switch defaults to enabled", () => {
  assert.equal(isDoctorLookBusyEnabled("chan"), true);
  assert.equal(isDoctorLookBusyEnabled("wong"), true);
  assert.equal(isDoctorLookBusyEnabled("unknown"), true);
});

function requestWith(headers: Record<string, string>) {
  return { headers: new Headers(headers) };
}

const notStaffDeps = {
  verifyChatwootToken: () => null,
  getCurrentUser: async () => ({ id: "patient-1" }),
  requireStaffRole: async () => {
    throw new Error("Forbidden");
  },
};

test("staff bypass requires a server-verified staff identity", async () => {
  const staffDeps = { ...notStaffDeps, getCurrentUser: async () => ({ id: "staff-1" }), requireStaffRole: async () => ({}) };
  const cookie = "sb-abc-auth-token=xyz";

  assert.equal(await isVerifiedStaffViewer(requestWith({ cookie }), staffDeps), true);
  // Logged-in non-staff user
  assert.equal(await isVerifiedStaffViewer(requestWith({ cookie }), notStaffDeps), false);
  // No auth cookie: session lookup is skipped
  let called = false;
  const spyDeps = { ...staffDeps, getCurrentUser: async () => { called = true; return { id: "staff-1" }; } };
  assert.equal(await isVerifiedStaffViewer(requestWith({ "x-staff": "1" }), spyDeps), false);
  assert.equal(called, false);
  // Signed Chatwoot Eden-tools token
  assert.equal(await isVerifiedStaffViewer(requestWith({}), { ...notStaffDeps, verifyChatwootToken: () => ({ userId: "s" }) }), true);
  // Errors resolve to patient view
  assert.equal(
    await isVerifiedStaffViewer(requestWith({ cookie }), { ...notStaffDeps, getCurrentUser: async () => { throw new Error("down"); } }),
    false
  );
});

test("shouldApplyLookBusy combines global switch, doctor switch and staff check", async () => {
  const staffDeps = { ...notStaffDeps, requireStaffRole: async () => ({}) };
  const cookie = "sb-abc-auth-token.0=xyz";
  assert.equal(await shouldApplyLookBusy(requestWith({}), "chan", notStaffDeps, {}), true);
  assert.equal(await shouldApplyLookBusy(requestWith({ cookie }), "chan", staffDeps, {}), false);
  assert.equal(await shouldApplyLookBusy(requestWith({}), "chan", notStaffDeps, { LOOK_BUSY_ENABLED: "false" }), false);
});

test("hasSupabaseAuthCookie detects plain and chunked auth cookies only", () => {
  assert.equal(hasSupabaseAuthCookie("a=1; sb-proj-auth-token=x"), true);
  assert.equal(hasSupabaseAuthCookie("sb-proj-auth-token.1=x"), true);
  assert.equal(hasSupabaseAuthCookie("staff=1; sb-proj-other=x"), false);
  assert.equal(hasSupabaseAuthCookie(null), false);
});

test("Saturday cap limits hiding to 15% even on a quiet day", () => {
  const day = buildDay(["10:00", "15:00"]); // quiet: 2/32 busy
  assert.equal(getHideRatio(0.05, "2026-10-31"), 0.15); // Saturday
  assert.equal(getHideRatio(0.05, "2026-10-30"), 0.3); // Friday
  assert.equal(getHideRatio(0.45, "2026-10-31"), 0.15);
  const result = applyLookBusy(input({ ...day, date: "2026-10-31" }));
  assert.equal(result.hideRatio, 0.15);
  assert.equal(result.hiddenSlots.length, Math.round(30 * 0.15));
});
