import assert from "node:assert/strict";
import test from "node:test";

import { parseBookingInitialSelection } from "@/lib/booking-search-params";
import { buildBookingUrl } from "@/lib/public-url";

test("parseBookingInitialSelection accepts doctor and source params", () => {
  const selection = parseBookingInitialSelection({
    doctor: "hon",
    clinic: "central",
    visitType: "followup",
    src: "ig",
  });

  assert.equal(selection.doctorId, "hon");
  assert.equal(selection.clinicId, "central");
  assert.equal(selection.visitType, "followup");
  assert.equal(selection.source, "ig");
});

test("parseBookingInitialSelection accepts legacy source param", () => {
  assert.equal(
    parseBookingInitialSelection({ doctor: "wong", source: "dr-wong" })
      .source,
    "dr-wong",
  );
});

test("buildBookingUrl can include source tracking", () => {
  const url = new URL(buildBookingUrl({ doctorId: "hon", source: "name-card" }));

  assert.equal(url.pathname, "/booking");
  assert.equal(url.searchParams.get("doctor"), "hon");
  assert.equal(url.searchParams.get("source"), "name-card");
});


test("homepage date survives parsing, including leap day and array params", () => {
  assert.equal(parseBookingInitialSelection({ date: "2026-10-30" }).date, "2026-10-30");
  assert.equal(parseBookingInitialSelection({ date: "2028-02-29" }).date, "2028-02-29");
  assert.equal(parseBookingInitialSelection({ date: ["2026-11-02", "2026-11-03"] }).date, "2026-11-02");
});

test("malformed and nonexistent calendar dates are ignored", () => {
  for (const date of ["2026-02-29", "2026-04-31", "2026-13-01", "2026-00-10", "2026-1-2", "2026-11-02T12:00:00Z", "", "<script>"]) {
    assert.equal(parseBookingInitialSelection({ date }).date, undefined, date);
  }
  assert.equal(parseBookingInitialSelection().date, undefined);
});
