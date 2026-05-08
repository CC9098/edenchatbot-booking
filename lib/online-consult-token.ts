import { createHmac, timingSafeEqual } from 'node:crypto';

import { fromBase64Url, toBase64Url } from '@/lib/widget-manage-token';

const STATIC_ONLINE_CONSULT_SECRET = 'eden-online-consult-sign';
const DEFAULT_ONLINE_CONSULT_TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 60; // 60 days

export type OnlineConsultTokenPayload = {
  type: 'online_consult';
  bookingId: string;
  calendarId: string;
  meetLink: string;
  doctorId?: string;
  doctorNameZh: string;
  appointmentDate: string;
  appointmentTime: string;
  expiresAtMs: number;
};

export type OnlineConsultTokenInput = Omit<OnlineConsultTokenPayload, 'type' | 'expiresAtMs'> & {
  ttlMs?: number;
  expiresAtMs?: number;
};

function getOnlineConsultSecret() {
  return (
    process.env.ONLINE_CONSULT_TOKEN_SECRET?.trim() ||
    process.env.WIDGET_BOOKING_MANAGE_SECRET?.trim() ||
    STATIC_ONLINE_CONSULT_SECRET
  );
}

function signOnlineConsultPayload(encodedPayload: string) {
  return createHmac('sha256', getOnlineConsultSecret())
    .update(`online-consult:${encodedPayload}`)
    .digest('base64url');
}

function safeCompare(value: string, expected: string) {
  const valueBuffer = Buffer.from(value, 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  return valueBuffer.length === expectedBuffer.length && timingSafeEqual(valueBuffer, expectedBuffer);
}

export function createOnlineConsultToken(input: OnlineConsultTokenInput): string {
  const expiresAtMs =
    Number.isFinite(input.expiresAtMs) && input.expiresAtMs
      ? input.expiresAtMs
      : Date.now() + (input.ttlMs && input.ttlMs > 0 ? input.ttlMs : DEFAULT_ONLINE_CONSULT_TOKEN_TTL_MS);

  const payload: OnlineConsultTokenPayload = {
    type: 'online_consult',
    bookingId: input.bookingId,
    calendarId: input.calendarId,
    meetLink: input.meetLink,
    doctorId: input.doctorId,
    doctorNameZh: input.doctorNameZh,
    appointmentDate: input.appointmentDate,
    appointmentTime: input.appointmentTime,
    expiresAtMs,
  };

  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = signOnlineConsultPayload(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function verifyOnlineConsultToken(token: string): {
  success: true;
  payload: OnlineConsultTokenPayload;
} | {
  success: false;
  error: string;
} {
  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) {
    return { success: false, error: '網上診症連結無效。' };
  }

  const expectedSignature = signOnlineConsultPayload(encodedPayload);
  if (!safeCompare(signature, expectedSignature)) {
    return { success: false, error: '網上診症連結無效。' };
  }

  let payload: OnlineConsultTokenPayload;
  try {
    payload = JSON.parse(fromBase64Url(encodedPayload)) as OnlineConsultTokenPayload;
  } catch {
    return { success: false, error: '網上診症連結無效。' };
  }

  if (
    payload?.type !== 'online_consult' ||
    !payload.bookingId ||
    !payload.calendarId ||
    !payload.meetLink ||
    !payload.doctorNameZh ||
    !payload.appointmentDate ||
    !payload.appointmentTime
  ) {
    return { success: false, error: '網上診症連結無效。' };
  }

  if (!Number.isFinite(payload.expiresAtMs) || payload.expiresAtMs <= Date.now()) {
    return { success: false, error: '網上診症連結已過期，請聯絡診所。' };
  }

  return { success: true, payload };
}
