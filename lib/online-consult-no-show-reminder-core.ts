import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

export const ONLINE_CONSULT_PATIENT_OPENED_KEY = 'eden_online_consult_patient_opened_at';
export const ONLINE_CONSULT_NO_SHOW_REMINDER_SENT_KEY = 'eden_online_consult_no_show_reminder_sent_at';
export const ONLINE_CONSULT_NO_SHOW_TIMEZONE = 'Asia/Hong_Kong';

export type OnlineConsultNoShowDecision =
  | { type: 'send' }
  | {
      type: 'skip';
      reason:
        | 'not_due'
        | 'missing_contact'
        | 'missing_booking_ref'
        | 'missing_meet_link'
        | 'patient_opened'
        | 'already_reminded'
        | 'cancelled';
    };

export type OnlineConsultNoShowCandidate = {
  id: string;
  googleEventId: string | null;
  calendarId: string | null;
  status: string | null;
  appointmentDate: string;
  appointmentTime: string;
  patientPhone: string;
};

export function getHongKongDateOnly(date: Date): string {
  return formatInTimeZone(date, ONLINE_CONSULT_NO_SHOW_TIMEZONE, 'yyyy-MM-dd');
}

export function parseAppointmentStartUtc(input: {
  appointmentDate: string;
  appointmentTime: string;
}): Date | null {
  const time = input.appointmentTime.trim();
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(time)) {
    return null;
  }

  const normalizedTime = time.length === 5 ? `${time}:00` : time;
  const date = fromZonedTime(
    `${input.appointmentDate}T${normalizedTime}`,
    ONLINE_CONSULT_NO_SHOW_TIMEZONE,
  );

  return Number.isNaN(date.getTime()) ? null : date;
}

export function isWithinNoShowReminderWindow(input: {
  appointmentDate: string;
  appointmentTime: string;
  now: Date;
  delayMinutes: number;
  lookbackMinutes: number;
}): boolean {
  const start = parseAppointmentStartUtc(input);
  if (!start) return false;

  const elapsedMs = input.now.getTime() - start.getTime();
  const delayMs = input.delayMinutes * 60 * 1000;
  const lookbackMs = input.lookbackMinutes * 60 * 1000;

  return elapsedMs >= delayMs && elapsedMs <= lookbackMs;
}

export function decideOnlineConsultNoShowReminder(input: {
  candidate: OnlineConsultNoShowCandidate;
  now: Date;
  delayMinutes: number;
  lookbackMinutes: number;
  meetLink?: string | null;
  patientOpenedAt?: string | null;
  reminderSentAt?: string | null;
}): OnlineConsultNoShowDecision {
  if (input.candidate.status !== 'confirmed') {
    return { type: 'skip', reason: 'cancelled' };
  }

  if (!input.candidate.googleEventId || !input.candidate.calendarId) {
    return { type: 'skip', reason: 'missing_booking_ref' };
  }

  if (!input.candidate.patientPhone.trim()) {
    return { type: 'skip', reason: 'missing_contact' };
  }

  if (!input.meetLink?.trim()) {
    return { type: 'skip', reason: 'missing_meet_link' };
  }

  if (input.patientOpenedAt) {
    return { type: 'skip', reason: 'patient_opened' };
  }

  if (input.reminderSentAt) {
    return { type: 'skip', reason: 'already_reminded' };
  }

  if (
    !isWithinNoShowReminderWindow({
      appointmentDate: input.candidate.appointmentDate,
      appointmentTime: input.candidate.appointmentTime,
      now: input.now,
      delayMinutes: input.delayMinutes,
      lookbackMinutes: input.lookbackMinutes,
    })
  ) {
    return { type: 'skip', reason: 'not_due' };
  }

  return { type: 'send' };
}

export function buildOnlineConsultNoShowReminderNote(input: {
  doctorNameZh: string;
  onlineConsultUrl: string;
}): string {
  return `${input.doctorNameZh}已準備網上診症，請按以下連結進入候診：${input.onlineConsultUrl}`;
}
