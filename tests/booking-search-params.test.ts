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
