import assert from "node:assert/strict";
import test from "node:test";

import {
  STAFF_PATIENT_DEFAULT_NOTE_MAX_LENGTH,
  STAFF_PATIENT_FOLLOW_UP_NOTE_MAX_LENGTH,
  buildStaffPatientMessageText,
  buildStaffPatientTemplateBodyParams,
  getStaffPatientNoteMaxLength,
} from "@/lib/staff-patient-messages";

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

test("staff follow-up keeps links on separate lines for a free-text WhatsApp reply", () => {
  const prescriptionUrl =
    "https://os.ectcm.com/PrintPrescription/PrintPrescription?clientID=1234567&clientRegisterID=7654321&doctorID=2468&paperSize=A4&langcode=CN";
  const invoiceUrl =
    "https://os.ectcm.com/InvoiceDetail/PrintInvoiceReceipt?clientRegisterID=7654321&invoiceType=S&clientID=1234567&invoiceID=9876543";
  const note = `${prescriptionUrl}\n\n${invoiceUrl}`;

  assert.ok(note.length > STAFF_PATIENT_DEFAULT_NOTE_MAX_LENGTH);

  const params = buildStaffPatientTemplateBodyParams({
    patientName: "測試病人",
    clinicNameZh: "佐敦",
    purpose: "follow_up",
    note,
  });
  const message = buildStaffPatientMessageText({
    patientName: "測試病人",
    clinicNameZh: "佐敦",
    purpose: "follow_up",
    note,
  });

  assert.equal(params["1"], `${prescriptionUrl} ｜ ${invoiceUrl}`);
  assert.match(message, new RegExp(`${prescriptionUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\n\\n${invoiceUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
  assert.doesNotMatch(params["1"], /[\r\n\t]/);
});

test("staff follow-up normalizes horizontal whitespace without removing paragraphs", () => {
  const note = "  第一段\r\n\r\n\r\n第二段\t內容  ";
  const message = buildStaffPatientMessageText({
    patientName: "測試病人",
    clinicNameZh: "佐敦",
    purpose: "follow_up",
    note,
  });

  assert.match(message, /第一段\n\n第二段 內容/);
  assert.doesNotMatch(message, /\r|\t/);
});

test("staff follow-up has a larger explicit note limit than other staff messages", () => {
  assert.equal(getStaffPatientNoteMaxLength("follow_up"), STAFF_PATIENT_FOLLOW_UP_NOTE_MAX_LENGTH);
  assert.equal(getStaffPatientNoteMaxLength("pre_visit"), STAFF_PATIENT_DEFAULT_NOTE_MAX_LENGTH);
  assert.ok(STAFF_PATIENT_FOLLOW_UP_NOTE_MAX_LENGTH > STAFF_PATIENT_DEFAULT_NOTE_MAX_LENGTH);
});
