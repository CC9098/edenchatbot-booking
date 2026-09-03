import assert from "node:assert/strict";
import test from "node:test";

import {
  CHATWOOT_DOCTOR_FORWARD_ACTION,
  buildChatwootDoctorForwardAttributes,
  buildChatwootDoctorForwardNote,
  getConfiguredChatwootDoctors,
  isChatwootDoctorAssignable,
  isExistingChatwootDoctorForward,
  isForwardableChatwootPatientMessage,
  parseChatwootDoctorAgentIds,
} from "@/lib/staff-chatwoot-doctor-forward";

test("doctor agent ids are positive, unique, and retain configured order", () => {
  assert.deepEqual(parseChatwootDoctorAgentIds("8, 12 8 invalid -1 0"), [8, 12]);
  assert.deepEqual(parseChatwootDoctorAgentIds(""), []);
});

test("configured doctors exclude missing and unconfirmed Chatwoot users", () => {
  const doctors = getConfiguredChatwootDoctors([
    { id: 8, name: "Dr Leung", confirmed: true, availability_status: "offline" },
    { id: 12, name: "Unconfirmed", confirmed: false },
  ], [12, 8, 99]);

  assert.deepEqual(doctors, [{
    id: 8,
    name: "Dr Leung",
    availabilityStatus: "offline",
  }]);
});

test("Chatwoot administrators or inbox members can receive a doctor handoff", () => {
  assert.equal(isChatwootDoctorAssignable({ id: 8, role: "administrator" }, []), true);
  assert.equal(isChatwootDoctorAssignable({ id: 12, role: "agent" }, [12]), true);
  assert.equal(isChatwootDoctorAssignable({ id: 13, role: "agent" }, [12]), false);
});

test("only a public incoming patient message with content or attachment is forwardable", () => {
  assert.equal(isForwardableChatwootPatientMessage({
    id: 101,
    message_type: "incoming",
    content: "病人資料",
    private: false,
  }, 101), true);
  assert.equal(isForwardableChatwootPatientMessage({
    id: 102,
    message_type: 0,
    content: "",
    attachments: [{ id: 3 }],
  }, 102), true);
  assert.equal(isForwardableChatwootPatientMessage({
    id: 103,
    message_type: "outgoing",
    content: "診所回覆",
  }, 103), false);
  assert.equal(isForwardableChatwootPatientMessage({
    id: 104,
    message_type: "incoming",
    content: "內部資料",
    private: true,
  }, 104), false);
});

test("doctor handoff note mentions the doctor and deep-links to the selected patient message", () => {
  const note = buildChatwootDoctorForwardNote({
    baseUrl: "https://chat.example/",
    accountId: 2,
    conversationId: 42,
    sourceMessageId: 101,
    doctor: { id: 8, name: "Dr Leung" },
  });

  assert.match(note, /\[@Dr Leung\]\(mention:\/\/user\/8\/Dr%20Leung\)/);
  assert.match(note, /https:\/\/chat\.example\/app\/accounts\/2\/conversations\/42\?messageId=101/);
  assert.match(note, /同一對話用 Reply 回覆病人/);
});

test("doctor handoff metadata supports idempotent read-back", () => {
  const attributes = buildChatwootDoctorForwardAttributes({
    sourceMessageId: 101,
    doctorAgentId: 8,
    forwardedByUserId: "staff-user",
    forwardedByRole: "assistant",
  });

  assert.deepEqual(attributes.eden_tools, {
    action: CHATWOOT_DOCTOR_FORWARD_ACTION,
    source_message_id: 101,
    doctor_agent_id: 8,
    forwarded_by_user_id: "staff-user",
    forwarded_by_role: "assistant",
  });
  assert.equal(isExistingChatwootDoctorForward({
    id: 202,
    private: true,
    content_attributes: attributes,
  }, 101, 8), true);
  assert.equal(isExistingChatwootDoctorForward({
    id: 203,
    private: true,
    content_attributes: attributes,
  }, 101, 9), false);
});
