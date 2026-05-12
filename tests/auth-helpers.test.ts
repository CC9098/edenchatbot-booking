import assert from "node:assert/strict";
import test from "node:test";

import { getFallbackStaffRoleForEmail } from "@/lib/auth-helpers";

test("getFallbackStaffRoleForEmail allows known doctor accounts", () => {
  assert.equal(getFallbackStaffRoleForEmail(" chetleung@gmail.com "), "doctor");
  assert.equal(getFallbackStaffRoleForEmail("DRLEUNG@EDENCLINIC.HK"), "doctor");
});

test("getFallbackStaffRoleForEmail allows known nurse accounts", () => {
  assert.equal(getFallbackStaffRoleForEmail("edenethel333@gmail.com"), "assistant");
  assert.equal(getFallbackStaffRoleForEmail("graceyung1207@gmail.com"), "assistant");
});

test("getFallbackStaffRoleForEmail allows clinic-domain accounts without opening public email", () => {
  assert.equal(getFallbackStaffRoleForEmail("new.staff@edenclinic.hk"), "assistant");
  assert.equal(getFallbackStaffRoleForEmail("patient@example.com"), null);
});
