import test from "node:test";
import assert from "node:assert/strict";

import {
  buildBookingContactPrefill,
  splitDisplayNameForBookingForm,
} from "@/lib/contact-utils";

test("splitDisplayNameForBookingForm handles compact Chinese names", () => {
  assert.deepEqual(splitDisplayNameForBookingForm("陳大文"), {
    firstName: "大文",
    lastName: "陳",
  });
});

test("splitDisplayNameForBookingForm handles compound Chinese surnames", () => {
  assert.deepEqual(splitDisplayNameForBookingForm("歐陽小明"), {
    firstName: "小明",
    lastName: "歐陽",
  });
});

test("splitDisplayNameForBookingForm handles western first-last names", () => {
  assert.deepEqual(splitDisplayNameForBookingForm("John Chan"), {
    firstName: "John",
    lastName: "Chan",
  });
});

test("splitDisplayNameForBookingForm keeps surname-first romanized names workable", () => {
  assert.deepEqual(splitDisplayNameForBookingForm("Chan Tai Man"), {
    firstName: "Tai Man",
    lastName: "Chan",
  });
});

test("buildBookingContactPrefill normalizes account contact defaults", () => {
  assert.deepEqual(
    buildBookingContactPrefill({
      displayName: "陳大文",
      email: "PATIENT@EXAMPLE.COM ",
      phone: " 9123 4567 ",
    }),
    {
      firstName: "大文",
      lastName: "陳",
      email: "patient@example.com",
      phone: "9123 4567",
    },
  );
});
