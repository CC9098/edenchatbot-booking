import { test, expect } from "@playwright/test";
import {
  createAuthenticatedApiContext,
  getFirstPatientUserId,
} from "./helpers/auth";
import { getMissingRoleEnvVars } from "./helpers/env";

test("RLS 隔離：跨帳戶不可讀寫", async () => {
  const missing = getMissingRoleEnvVars(["doctor", "patient", "unrelated"]);
  test.skip(missing.length > 0, `Missing env: ${missing.join(", ")}`);

  const doctorApi = await createAuthenticatedApiContext("doctor");
  const unrelatedApi = await createAuthenticatedApiContext("unrelated");
  const patientApi = await createAuthenticatedApiContext("patient");

  try {
    const patientUserId = await getFirstPatientUserId(doctorApi);
    test.skip(!patientUserId, "No patient assigned to doctor account for RLS test.");

    const forbiddenRead = await unrelatedApi.get(
      `/api/doctor/patients/${patientUserId}/profile`
    );
    expect(forbiddenRead.status()).toBe(403);

    const forbiddenWrite = await unrelatedApi.patch(
      `/api/doctor/patients/${patientUserId}/constitution`,
      {
        data: { constitution: "crossing", constitutionNote: "should fail" },
      }
    );
    expect(forbiddenWrite.status()).toBe(403);

    const patientForbidden = await patientApi.get("/api/doctor/patients?limit=1");
    expect(patientForbidden.status()).toBe(403);
  } finally {
    await doctorApi.dispose();
    await unrelatedApi.dispose();
    await patientApi.dispose();
  }
});
