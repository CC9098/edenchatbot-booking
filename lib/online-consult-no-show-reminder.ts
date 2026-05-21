import {
  ONLINE_CONSULT_NO_SHOW_REMINDER_SENT_KEY,
  ONLINE_CONSULT_PATIENT_OPENED_KEY,
  buildOnlineConsultNoShowReminderNote,
  decideOnlineConsultNoShowReminder,
  getHongKongDateOnly,
  type OnlineConsultNoShowCandidate,
} from '@/lib/online-consult-no-show-reminder-core';
import { createOnlineConsultToken } from '@/lib/online-consult-token';
import { buildOnlineConsultUrl } from '@/lib/public-url';
import { createServiceClient } from '@/lib/supabase';
import { getClinicWhatsappPhone } from '@/lib/whatsapp-booking';
import { getEvent, patchEventPrivateMetadata } from '@/lib/google-calendar';
import { sendStaffPatientWhatsappMessage } from '@/lib/chatwoot-whatsapp';

const DEFAULT_DELAY_MINUTES = 5;
const DEFAULT_LOOKBACK_MINUTES = 35;

type OnlineConsultNoShowRow = {
  id: string;
  status: string | null;
  google_event_id: string | null;
  calendar_id: string | null;
  doctor_id: string;
  doctor_name_zh: string;
  clinic_id: string;
  clinic_name_zh: string;
  appointment_date: string;
  appointment_time: string;
  patient_name: string;
  phone: string;
  email: string | null;
};

type OnlineConsultNoShowSummary = {
  now: string;
  targetDates: string[];
  dryRun: boolean;
  delayMinutes: number;
  lookbackMinutes: number;
  candidates: number;
  eventMissing: number;
  eligible: number;
  whatsappWouldSend: number;
  whatsappSent: number;
  whatsappFailed: number;
  marked: number;
  markFailed: number;
  skipped: Record<string, number>;
  errors: string[];
};

function getConfiguredPositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function getMeetLinkFromEvent(event: any): string {
  const hangoutLink = typeof event?.hangoutLink === 'string' ? event.hangoutLink.trim() : '';
  if (hangoutLink) return hangoutLink;

  const entryPoints = Array.isArray(event?.conferenceData?.entryPoints)
    ? event.conferenceData.entryPoints
    : [];
  const videoEntry = entryPoints.find(
    (entry: any) => entry?.entryPointType === 'video' && typeof entry?.uri === 'string',
  );

  return videoEntry?.uri?.trim() || '';
}

function toCandidate(row: OnlineConsultNoShowRow): OnlineConsultNoShowCandidate {
  return {
    id: row.id,
    googleEventId: row.google_event_id,
    calendarId: row.calendar_id,
    status: row.status,
    appointmentDate: row.appointment_date,
    appointmentTime: row.appointment_time,
    patientPhone: row.phone,
  };
}

function incrementSkip(summary: OnlineConsultNoShowSummary, reason: string) {
  summary.skipped[reason] = (summary.skipped[reason] || 0) + 1;
}

async function listCandidateRows(targetDates: string[]): Promise<OnlineConsultNoShowRow[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('booking_intake')
    .select(
      [
        'id',
        'status',
        'google_event_id',
        'calendar_id',
        'doctor_id',
        'doctor_name_zh',
        'clinic_id',
        'clinic_name_zh',
        'appointment_date',
        'appointment_time',
        'patient_name',
        'phone',
        'email',
      ].join(', '),
    )
    .eq('status', 'confirmed')
    .eq('clinic_id', 'online')
    .in('appointment_date', targetDates)
    .order('appointment_time', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const rows = Array.isArray(data) ? (data as any[]) : [];

  return rows.map((row) => ({
    id: String(row.id || ''),
    status: typeof row.status === 'string' ? row.status : null,
    google_event_id: typeof row.google_event_id === 'string' ? row.google_event_id : null,
    calendar_id: typeof row.calendar_id === 'string' ? row.calendar_id : null,
    doctor_id: String(row.doctor_id || ''),
    doctor_name_zh: String(row.doctor_name_zh || ''),
    clinic_id: String(row.clinic_id || ''),
    clinic_name_zh: String(row.clinic_name_zh || ''),
    appointment_date: String(row.appointment_date || ''),
    appointment_time: String(row.appointment_time || ''),
    patient_name: String(row.patient_name || ''),
    phone: String(row.phone || ''),
    email: typeof row.email === 'string' ? row.email : null,
  }));
}

export async function runOnlineConsultNoShowReminderJob(options: {
  now?: Date;
  targetDate?: string;
  dryRun?: boolean;
  delayMinutes?: number;
  lookbackMinutes?: number;
} = {}): Promise<OnlineConsultNoShowSummary> {
  const now = options.now || new Date();
  const delayMinutes =
    options.delayMinutes ||
    getConfiguredPositiveInt(process.env.ONLINE_CONSULT_NO_SHOW_REMINDER_DELAY_MINUTES, DEFAULT_DELAY_MINUTES);
  const lookbackMinutes =
    options.lookbackMinutes ||
    getConfiguredPositiveInt(process.env.ONLINE_CONSULT_NO_SHOW_REMINDER_LOOKBACK_MINUTES, DEFAULT_LOOKBACK_MINUTES);
  const lookbackStart = new Date(now.getTime() - lookbackMinutes * 60 * 1000);
  const targetDates = options.targetDate
    ? [options.targetDate]
    : Array.from(new Set([getHongKongDateOnly(now), getHongKongDateOnly(lookbackStart)]));

  const summary: OnlineConsultNoShowSummary = {
    now: now.toISOString(),
    targetDates,
    dryRun: Boolean(options.dryRun),
    delayMinutes,
    lookbackMinutes,
    candidates: 0,
    eventMissing: 0,
    eligible: 0,
    whatsappWouldSend: 0,
    whatsappSent: 0,
    whatsappFailed: 0,
    marked: 0,
    markFailed: 0,
    skipped: {},
    errors: [],
  };

  const rows = await listCandidateRows(targetDates);
  summary.candidates = rows.length;

  for (const row of rows) {
    const candidate = toCandidate(row);
    if (!candidate.calendarId || !candidate.googleEventId) {
      incrementSkip(summary, 'missing_booking_ref');
      continue;
    }

    const eventResult = await getEvent(candidate.calendarId, candidate.googleEventId);
    if (!eventResult.success || !eventResult.event) {
      summary.eventMissing += 1;
      if (summary.errors.length < 10) {
        summary.errors.push(`${candidate.calendarId}/${candidate.googleEventId}: ${eventResult.error || 'missing event'}`);
      }
      continue;
    }

    const event = eventResult.event;
    const meetLink = getMeetLinkFromEvent(event);
    const privateMetadata = event?.extendedProperties?.private || {};
    const decision = decideOnlineConsultNoShowReminder({
      candidate,
      now,
      delayMinutes,
      lookbackMinutes,
      meetLink,
      patientOpenedAt: privateMetadata[ONLINE_CONSULT_PATIENT_OPENED_KEY],
      reminderSentAt: privateMetadata[ONLINE_CONSULT_NO_SHOW_REMINDER_SENT_KEY],
    });

    if (decision.type === 'skip') {
      incrementSkip(summary, decision.reason);
      continue;
    }

    summary.eligible += 1;

    const token = createOnlineConsultToken({
      bookingId: candidate.googleEventId,
      calendarId: candidate.calendarId,
      meetLink,
      doctorId: row.doctor_id,
      doctorNameZh: row.doctor_name_zh,
      appointmentDate: row.appointment_date,
      appointmentTime: row.appointment_time,
    });
    const onlineConsultUrl = buildOnlineConsultUrl({ token });
    const note = buildOnlineConsultNoShowReminderNote({
      doctorNameZh: row.doctor_name_zh,
      onlineConsultUrl,
    });

    if (options.dryRun) {
      summary.whatsappWouldSend += 1;
      continue;
    }

    const whatsappResult = await sendStaffPatientWhatsappMessage({
      patientName: row.patient_name || '病人',
      phone: row.phone,
      email: row.email || '',
      clinicNameZh: row.clinic_name_zh || '醫天圓中醫診所',
      clinicWhatsappPhone: getClinicWhatsappPhone(row.clinic_id),
      purpose: 'online_waiting',
      note,
      linkUrl: onlineConsultUrl,
    });

    if (!whatsappResult.success) {
      summary.whatsappFailed += 1;
      if (summary.errors.length < 10) {
        summary.errors.push(`${row.id}: ${whatsappResult.error || 'send failed'}`);
      }
      continue;
    }

    summary.whatsappSent += 1;
    const markResult = await patchEventPrivateMetadata(candidate.calendarId, candidate.googleEventId, {
      [ONLINE_CONSULT_NO_SHOW_REMINDER_SENT_KEY]: new Date().toISOString(),
    });

    if (markResult.success) {
      summary.marked += 1;
    } else {
      summary.markFailed += 1;
    }
  }

  return summary;
}
