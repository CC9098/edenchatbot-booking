import assert from "node:assert/strict";
import test from "node:test";

import { shouldSearchStaffContactQuery } from "@/lib/staff-contact-search";

test("staff contact search allows one CJK character", () => {
  assert.equal(shouldSearchStaffContactQuery("張"), true);
  assert.equal(shouldSearchStaffContactQuery(" 明 "), true);
});

test("staff contact search keeps short latin or phone queries at two characters", () => {
  assert.equal(shouldSearchStaffContactQuery("a"), false);
  assert.equal(shouldSearchStaffContactQuery("9"), false);
  assert.equal(shouldSearchStaffContactQuery("ab"), true);
  assert.equal(shouldSearchStaffContactQuery("96"), true);
});
