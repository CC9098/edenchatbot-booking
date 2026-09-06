import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { normalizeEdenMessages, normalizeEdenConversation, type RawEdenMessage } from "@/lib/eden-conversations";
import { EdenMessageDelivery } from "@/components/staff/EdenMessageDelivery";

const raw = (overrides: Partial<RawEdenMessage> = {}): RawEdenMessage => ({
  id: 1, message_type: 1, private: false, content: "測試訊息",
  status: "sent", source_id: "wamid.synthetic", ...overrides,
});
const normalize = (value: RawEdenMessage) => normalizeEdenMessages([value])[0];
const render = (value: RawEdenMessage) =>
  renderToStaticMarkup(React.createElement(EdenMessageDelivery, { message: normalize(value) }));

// IDs, status and error only, replaying the three audited production shapes.
for (const id of [16435, 16684, 16782]) {
  test(`audited message ${id}: sent plus 131026 is visibly uncertain, never a success tick`, () => {
    const value = raw({ id, content_attributes: { external_error: "131026: Message undeliverable" } });
    const message = normalize(value);
    assert.equal(message.status, "sent"); // Preserve source evidence.
    assert.equal(message.deliveryIssue?.code, "131026");
    assert.match(message.deliveryIssue!.description, /核對電話號碼/);
    const html = render(value);
    assert.match(html, /送達異常・待確認/);
    assert.doesNotMatch(html, /已提交|已送達|病人已讀/);
  });
}

test("only explicit delivered/read evidence renders a success receipt", () => {
  assert.match(render(raw({ status: "delivered" })), /aria-label="已送達"/);
  assert.match(render(raw({ status: "read" })), /aria-label="病人已讀"/);
  assert.match(render(raw()), /已提交，未確認送達/);
  for (const status of [null, "", "queued", "unknown"]) {
    const html = render(raw({ status }));
    assert.match(html, /待確認/);
    assert.doesNotMatch(html, /已提交|已送達|病人已讀/);
  }
});

test("conflicting errors never disappear behind delivered/read icons", () => {
  for (const status of ["delivered", "read"]) {
    const value = raw({ status, content_attributes: { external_error: "131026: Message undeliverable" } });
    assert.equal(normalize(value).status, status);
    assert.match(render(value), /送達異常・待確認/);
    assert.doesNotMatch(render(value), /aria-label="已送達"|aria-label="病人已讀"/);
  }
});

test("explicit failure is distinct from conflicting or absent receipts", () => {
  assert.match(render(raw({ status: "failed" })), /未能送達/);
});

test("deleted template attempts, incoming messages and private notes do not raise delivery alarms", () => {
  for (const overrides of [
    { content_attributes: { external_error: "131026: hidden", deleted: true } },
    { message_type: 0 },
    { private: true },
  ]) {
    const value = raw({ status: "failed", content_attributes: { external_error: "131026: hidden" }, ...overrides });
    assert.equal(normalize(value).deliveryIssue, null);
  }
  assert.match(render(raw({ status: "failed", content_attributes: { deleted: true } })), /已移除/);
});

test("provider payloads never leak into staff-facing delivery explanations", () => {
  const value = raw({ content_attributes: { external_error: "132018: patient-secret https://patient.invalid/token" } });
  const message = normalize(value);
  assert.equal(message.deliveryIssue?.code, "132018");
  assert.doesNotMatch(JSON.stringify(message.deliveryIssue), /patient-secret|patient.invalid|token/);
});

test("latest failed outgoing message exposes a list badge without changing clinical or workflow state", () => {
  const c = normalizeEdenConversation({
    id: 42, inbox_id: 2, status: "resolved",
    messages: [raw({ content_attributes: { external_error: "131026: Message undeliverable" } })],
  }, { id: "staff-test", name: "同事", role: "assistant", agentId: null });
  assert.equal(c.deliveryIssue?.label, "送達異常・待確認");
  assert.equal(c.stage, "done");
});
