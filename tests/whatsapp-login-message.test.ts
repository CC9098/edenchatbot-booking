import test from "node:test";
import assert from "node:assert/strict";
import { buildWhatsappManageVerificationText } from "@/lib/whatsapp-manage";
import { buildWhatsappAuthenticationOtpParams } from "@/lib/whatsapp-login-template";
import { sendBookingManageOtpWhatsapp } from "@/lib/chatwoot-whatsapp";

test("member login codes describe login and use the requested expiry", () => {
  const text = buildWhatsappManageVerificationText({ patientName: "", code: "123456", expiryMinutes: 5, purpose: "member_login" });
  assert.match(text, /會員登入驗證碼是：123456/);
  assert.match(text, /5 分鐘後失效/);
  assert.doesNotMatch(text, /管理預約：/);
});

test("booking management codes retain the existing management instructions", () => {
  const text = buildWhatsappManageVerificationText({ patientName: "", code: "123456" });
  assert.match(text, /預約管理驗證碼是：123456/);
  assert.match(text, /10 分鐘後失效/);
  assert.match(text, /管理預約：/);
  assert.doesNotMatch(text, /會員登入/);
});

test("authentication copy-code templates send the same code in body and URL button", () => {
  assert.deepEqual(buildWhatsappAuthenticationOtpParams("123456"), {
    body: { "1": "123456" }, buttons: [{ type: "url", parameter: "123456" }],
  });
});

for (const authenticationApproved of [true, false]) test(authenticationApproved
  ? "member login selects its approved authentication template instead of a stale management template"
  : "member login uses the approved existing code template while authentication approval is pending", async () => {
  const keys = ["CHATWOOT_BASE_URL", "CHATWOOT_API_ACCESS_TOKEN", "CHATWOOT_ACCOUNT_ID", "CHATWOOT_WHATSAPP_INBOX_ID", "CHATWOOT_WHATSAPP_OTP_TEMPLATE_NAME", "CHATWOOT_WHATSAPP_LOGIN_OTP_TEMPLATE_NAME", "CHATWOOT_WHATSAPP_LOGIN_OTP_TEMPLATE_LANGUAGE"];
  const env = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  const originalFetch = global.fetch;
  process.env.CHATWOOT_BASE_URL = "https://chatwoot.test";
  process.env.CHATWOOT_API_ACCESS_TOKEN = "test-token";
  process.env.CHATWOOT_ACCOUNT_ID = "2";
  process.env.CHATWOOT_WHATSAPP_INBOX_ID = "2";
  process.env.CHATWOOT_WHATSAPP_OTP_TEMPLATE_NAME = "nonexistent_management_template";
  delete process.env.CHATWOOT_WHATSAPP_LOGIN_OTP_TEMPLATE_NAME;
  delete process.env.CHATWOOT_WHATSAPP_LOGIN_OTP_TEMPLATE_LANGUAGE;
  let sent = 0;
  const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });
  global.fetch = async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    assert.equal(url.hostname, "chatwoot.test");
    if (url.pathname.endsWith("/inboxes")) return json({ payload: [{ id: 2, channel_type: "Channel::Whatsapp" }] });
    if (url.pathname.endsWith("/inboxes/2")) return json({ id: 2, channel_type: "Channel::Whatsapp", message_templates: [
      { name: "eden_member_login_otp", status: authenticationApproved ? "APPROVED" : "PENDING", language: "zh_HK", category: "AUTHENTICATION" },
      { name: "booking_manage_otp", status: "APPROVED", language: "zh_HK", category: "MARKETING" },
    ] });
    if (url.pathname.endsWith("/sync_templates")) return json({});
    if (url.pathname.endsWith("/contacts/search")) return json({ payload: [{ id: 100, phone_number: "+85290000001", contact_inboxes: [{ inbox: { id: 2 }, source_id: "85290000001" }] }] });
    if (url.pathname.endsWith("/contacts/100/conversations")) return json({ payload: [{ id: 200, inbox_id: 2, status: "open", can_reply: true }] });
    if (url.pathname.endsWith("/conversations/200/messages") && init?.method === "POST") {
      const payload = JSON.parse(String(init.body));
      assert.deepEqual(payload.template_params, {
        name: authenticationApproved ? "eden_member_login_otp" : "booking_manage_otp",
        category: authenticationApproved ? "AUTHENTICATION" : "MARKETING", language: "zh_HK",
        processed_params: authenticationApproved
          ? { body: { "1": "123456" }, buttons: [{ type: "url", parameter: "123456" }] }
          : { body: { verification_code: "123456" } },
      });
      assert.match(payload.content, /會員登入/);
      sent++;
      return json({ id: 300, status: "delivered" });
    }
    if (url.pathname.endsWith("/conversations/200/messages")) return json({ payload: [{ id: 300, status: "delivered" }] });
    throw new Error("Unexpected test request: " + url.pathname);
  };
  try {
    const result = await sendBookingManageOtpWhatsapp({ patientName: "測試", phone: "+85290000001", email: "", code: "123456", purpose: "member_login" });
    assert.equal(result.success, true);
    assert.equal(sent, 1);
    assert.equal(result.verificationLabel, authenticationApproved ? undefined : "預約管理驗證碼");
  } finally {
    global.fetch = originalFetch;
    for (const key of keys) { if (env[key] === undefined) delete process.env[key]; else process.env[key] = env[key]; }
  }
});
