export const ONLINE_CONSULT_DOCTOR_NOTIFY_SENT_KEY = 'eden_online_consult_doctor_notified_at';
export const ONLINE_CONSULT_DOCTOR_NOTIFY_SENT_CHANNEL_KEY = 'eden_online_consult_doctor_notified_channel';
export const ONLINE_CONSULT_DOCTOR_NOTIFY_PENDING_AT_KEY = 'eden_online_consult_doctor_notify_pending_at';
export const ONLINE_CONSULT_DOCTOR_NOTIFY_PENDING_OWNER_KEY = 'eden_online_consult_doctor_notify_pending_owner';
export const ONLINE_CONSULT_DOCTOR_NOTIFY_PENDING_TTL_MS = 2 * 60 * 1000;

export function isFreshOnlineConsultDoctorNotificationPending(
  pendingAt: string | undefined,
  now: Date,
  ttlMs = ONLINE_CONSULT_DOCTOR_NOTIFY_PENDING_TTL_MS,
): boolean {
  if (!pendingAt) return false;
  const pendingTime = Date.parse(pendingAt);
  if (!Number.isFinite(pendingTime)) return false;
  return now.getTime() - pendingTime < ttlMs;
}
