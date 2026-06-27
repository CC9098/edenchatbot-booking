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

test("staff follow-up message stays generic for arbitrary staff notes", () => {
  const message = buildStaffPatientMessageText({
    patientName: "chet",
    clinicNameZh: "佐敦",
    purpose: "follow_up",
    note: "你要的收據已準備好，可以到診所領取。",
  });

  assert.match(message, /以下是診所給你的跟進訊息：/);
  assert.match(message, /你要的收據已準備好，可以到診所領取。/);
  assert.doesNotMatch(message, /你好 chet/);
  assert.doesNotMatch(message, /姑娘需要跟進你的查詢/);
  assert.doesNotMatch(message, /診所：佐敦/);
});
