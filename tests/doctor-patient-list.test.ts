import test from "node:test";
import assert from "node:assert/strict";

import {
  buildVisiblePatientIds,
  prioritizeSelfPatient,
} from "@/lib/doctor-patient-list";

test("buildVisiblePatientIds keeps current staff visible while excluding other staff", () => {
  const patientIds = buildVisiblePatientIds({
    activeStaffUserIds: ["staff-self", "staff-other"],
    currentStaffUserId: "staff-self",
    profileIds: ["patient-profile", "staff-other"],
    patientProfileUserIds: ["patient-family"],
    patientCareTeamIds: ["patient-a", "staff-other"],
    patientCareProfileIds: ["patient-b"],
    bookingUserIds: ["staff-self"],
    symptomPatientIds: ["patient-c"],
    followUpPatientIds: [],
    instructionPatientIds: [],
  });

  assert.deepEqual(patientIds, [
    "patient-a",
    "patient-b",
    "patient-c",
    "patient-family",
    "patient-profile",
    "staff-self",
  ]);
});

test("buildVisiblePatientIds adds current staff even without patient records", () => {
  const patientIds = buildVisiblePatientIds({
    activeStaffUserIds: ["staff-self"],
    currentStaffUserId: "staff-self",
    patientCareTeamIds: [],
    patientCareProfileIds: [],
    bookingUserIds: [],
    symptomPatientIds: [],
    followUpPatientIds: [],
    instructionPatientIds: [],
  });

  assert.deepEqual(patientIds, ["staff-self"]);
});

test("buildVisiblePatientIds includes non-staff profiles without care activity", () => {
  const patientIds = buildVisiblePatientIds({
    activeStaffUserIds: ["staff-self", "staff-other"],
    currentStaffUserId: "staff-self",
    profileIds: ["patient-a", "patient-b", "staff-other"],
    patientCareTeamIds: [],
    patientCareProfileIds: [],
    bookingUserIds: [],
    symptomPatientIds: [],
    followUpPatientIds: [],
    instructionPatientIds: [],
  });

  assert.deepEqual(patientIds, ["patient-a", "patient-b", "staff-self"]);
});

test("buildVisiblePatientIds includes accounts that only have patient_profiles", () => {
  const patientIds = buildVisiblePatientIds({
    activeStaffUserIds: ["staff-self", "staff-other"],
    currentStaffUserId: "staff-self",
    patientProfileUserIds: ["patient-family", "staff-other"],
    patientCareTeamIds: [],
    patientCareProfileIds: [],
    bookingUserIds: [],
    symptomPatientIds: [],
    followUpPatientIds: [],
    instructionPatientIds: [],
  });

  assert.deepEqual(patientIds, ["patient-family", "staff-self"]);
});

test("buildVisiblePatientIds can include all active staff when requested", () => {
  const patientIds = buildVisiblePatientIds({
    activeStaffUserIds: ["staff-self", "staff-other", "staff-third"],
    currentStaffUserId: "staff-self",
    includeOtherStaff: true,
    profileIds: ["patient-a", "staff-other"],
    patientCareTeamIds: [],
    patientCareProfileIds: [],
    bookingUserIds: [],
    symptomPatientIds: [],
    followUpPatientIds: [],
    instructionPatientIds: [],
  });

  assert.deepEqual(patientIds, [
    "patient-a",
    "staff-other",
    "staff-self",
    "staff-third",
  ]);
});

test("prioritizeSelfPatient moves self to the front without duplication", () => {
  const prioritized = prioritizeSelfPatient(
    ["patient-a", "staff-self", "patient-b"],
    "staff-self",
  );

  assert.deepEqual(prioritized, ["staff-self", "patient-a", "patient-b"]);
});
