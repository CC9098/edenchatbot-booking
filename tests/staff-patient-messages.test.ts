import assert from "node:assert/strict";
import test from "node:test";

import { buildStaffPatientMessageText } from "@/lib/staff-patient-messages";

test("staff follow-up message ends with the WhatsApp reply instruction", () => {
  const message = buildStaffPatientMessageText({
    patientName: "病人",
    clinicNameZh: "佐敦",
    purpose: "follow_up",
    note: "你要的收據已準備好，可以到診所領取。",
  });

  assert.match(message, /如有問題，請直接回覆此 WhatsApp。$/);
});
