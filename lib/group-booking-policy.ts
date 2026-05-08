import { fromZonedTime, toZonedTime } from "date-fns-tz";

const HONG_KONG_TIMEZONE = "Asia/Hong_Kong";

export type GroupBookingPolicy = {
  doctorId: string;
  clinicId: string;
  minPatients: number;
  cancelHoursBeforeStart: number;
  notice: string;
  sessions: Array<{
    dayOfWeek: number;
    start: string;
    end: string;
  }>;
};

export type GroupBookingSession = GroupBookingPolicy["sessions"][number] & {
  policy: GroupBookingPolicy;
};

export const DR_WONG_GROUP_BOOKING_NOTICE =
  "";

export const DR_WONG_GROUP_BOOKING_CONFIRMED_NOTICE =
  "預約已確認。請按時到診。";

export const GROUP_BOOKING_POLICIES: readonly GroupBookingPolicy[] = [];

function toMinutes(value: string): number {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function getDayOfWeekInHongKong(dateIso: string): number {
  const dayStartUtc = fromZonedTime(`${dateIso}T00:00:00`, HONG_KONG_TIMEZONE);
  return toZonedTime(dayStartUtc, HONG_KONG_TIMEZONE).getDay();
}

export function getGroupBookingPolicy(
  doctorId?: string | null,
  clinicId?: string | null,
): GroupBookingPolicy | null {
  return (
    GROUP_BOOKING_POLICIES.find(
      (policy) => policy.doctorId === doctorId && policy.clinicId === clinicId,
    ) ?? null
  );
}

export function findGroupBookingSession(params: {
  doctorId?: string | null;
  clinicId?: string | null;
  date: string;
  time: string;
}): GroupBookingSession | null {
  const policy = getGroupBookingPolicy(params.doctorId, params.clinicId);
  if (!policy) return null;

  const dayOfWeek = getDayOfWeekInHongKong(params.date);
  const timeMinutes = toMinutes(params.time);
  const session = policy.sessions.find((candidate) => {
    return (
      candidate.dayOfWeek === dayOfWeek &&
      timeMinutes >= toMinutes(candidate.start) &&
      timeMinutes < toMinutes(candidate.end)
    );
  });

  return session ? { ...session, policy } : null;
}

export function getGroupBookingNotice(
  doctorId?: string | null,
  clinicId?: string | null,
): string | null {
  return getGroupBookingPolicy(doctorId, clinicId)?.notice ?? null;
}

export function getGroupSessionCancelAt(params: {
  date: string;
  sessionStart: string;
  cancelHoursBeforeStart: number;
}): Date {
  const sessionStartUtc = fromZonedTime(`${params.date}T${params.sessionStart}:00`, HONG_KONG_TIMEZONE);
  return new Date(sessionStartUtc.getTime() - params.cancelHoursBeforeStart * 60 * 60 * 1000);
}

export function getGroupSessionStartUtc(date: string, sessionStart: string): Date {
  return fromZonedTime(`${date}T${sessionStart}:00`, HONG_KONG_TIMEZONE);
}
