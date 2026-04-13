import { createHmac } from 'node:crypto';

const MANAGE_ACCESS_TOKEN_TTL_MS = 1000 * 60 * 60 * 72; // 72 hours
const STATIC_WIDGET_MANAGE_SECRET = 'eden-widget-booking-manage-sign';

type ManageAccessTokenPayload = {
  type: 'access';
  phoneDigits: string;
  expiresAtMs: number;
};

function getWidgetManageSecret() {
  return process.env.WIDGET_BOOKING_MANAGE_SECRET?.trim() || STATIC_WIDGET_MANAGE_SECRET;
}

export function toBase64Url(value: string) {
  return Buffer.from(value, 'utf8').toString('base64url');
}

export function fromBase64Url(value: string) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

export function signManagePayload(encodedPayload: string) {
  return createHmac('sha256', getWidgetManageSecret())
    .update(`widget-booking:${encodedPayload}`)
    .digest('base64url');
}

export function createManageAccessToken(
  phoneDigits: string,
  options?: { ttlMs?: number },
): string {
  const payload: ManageAccessTokenPayload = {
    type: 'access',
    phoneDigits,
    expiresAtMs: Date.now() + (options?.ttlMs && options.ttlMs > 0 ? options.ttlMs : MANAGE_ACCESS_TOKEN_TTL_MS),
  };
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = signManagePayload(encodedPayload);
  return `${encodedPayload}.${signature}`;
}
