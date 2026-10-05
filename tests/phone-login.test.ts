import test from "node:test";
import assert from "node:assert/strict";

import {
  getLoginOtpSecret,
  getLoginOtpThrottleDecision,
  type LoginOtpThrottleRow,
} from "@/lib/phone-login";

function rowAt(ms: number): LoginOtpThrottleRow {
  return { created_at: new Date(ms).toISOString() };
}

test("login OTP secret works without a separate configured secret and never uses a public constant", () => {
  const originalOtp = process.env.WIDGET_BOOKING_OTP_SECRET;
  const originalService = process.env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    delete process.env.WIDGET_BOOKING_OTP_SECRET;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-server-secret-a";
    const first = getLoginOtpSecret();
    assert.notEqual(first, process.env.SUPABASE_SERVICE_ROLE_KEY);
    assert.equal(first, getLoginOtpSecret());
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-server-secret-b";
    assert.notEqual(first, getLoginOtpSecret());
    process.env.WIDGET_BOOKING_OTP_SECRET = " explicit-test-otp-secret ";
    assert.equal(getLoginOtpSecret(), "explicit-test-otp-secret");
    delete process.env.WIDGET_BOOKING_OTP_SECRET;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    assert.throws(() => getLoginOtpSecret(), /登入服務暫時未能連線/);
  } finally {
    if (originalOtp === undefined) delete process.env.WIDGET_BOOKING_OTP_SECRET;
    else process.env.WIDGET_BOOKING_OTP_SECRET = originalOtp;
    if (originalService === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = originalService;
  }
});

test("getLoginOtpThrottleDecision blocks resend inside cooldown window", () => {
  const nowMs = Date.UTC(2026, 3, 27, 9, 0, 0);
  const decision = getLoginOtpThrottleDecision(
    [rowAt(nowMs - 15_000)],
    nowMs,
    { cooldownSeconds: 60, maxRequestsPerHour: 5 },
  );

  assert.equal(decision.allowed, false);
  if (!decision.allowed) {
    assert.equal(decision.retryAfterSeconds, 45);
  }
});

test("getLoginOtpThrottleDecision blocks hourly request bursts", () => {
  const nowMs = Date.UTC(2026, 3, 27, 9, 0, 0);
  const recentRows = [5, 10, 20, 30, 40].map((minutesAgo) =>
    rowAt(nowMs - minutesAgo * 60_000),
  );

  const decision = getLoginOtpThrottleDecision(
    recentRows,
    nowMs,
    { cooldownSeconds: 60, maxRequestsPerHour: 5 },
  );

  assert.deepEqual(decision, {
    allowed: false,
    error: "驗證碼索取太頻密，請稍後再試。",
  });
});

test("getLoginOtpThrottleDecision allows normal request cadence", () => {
  const nowMs = Date.UTC(2026, 3, 27, 9, 0, 0);
  const decision = getLoginOtpThrottleDecision(
    [rowAt(nowMs - 10 * 60_000), rowAt(nowMs - 2 * 60 * 60_000)],
    nowMs,
    { cooldownSeconds: 60, maxRequestsPerHour: 5 },
  );

  assert.deepEqual(decision, { allowed: true });
});
