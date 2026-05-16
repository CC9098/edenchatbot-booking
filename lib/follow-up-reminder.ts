import { fromZonedTime } from 'date-fns-tz';

import { createServiceClient } from '@/lib/supabase';
import { normalizePhoneForSearch } from '@/lib/contact-utils';
import { listEventsInRange } from '@/lib/google-calendar';
import { buildBookingUrl } from '@/lib/public-url';
import { sendStaffPatientWhatsappMessage } from '@/lib/chatwoot-whatsapp';
import { getActiveCalendarIds } from '@/lib/doctor-schedule-store';
import { getClinicWhatsappPhone } from '@/lib/whatsapp-booking';
import {
  HONG_KONG_TIMEZONE,
  addDateOnlyDays,
  buildFollowUpReminderNote,
  decideFollowUpReminder,
  findCalendarBookingPresence,
  getPhoneDigitVariants,
  getTodayInHongKongDate,
  phoneDigitsMatch,
  type BookingPresence,
  type FollowUpReminderCandidate,
} from '@/lib/follow-up-reminder-core';

const DEFAULT_LOOKAHEAD_DAYS = 14;
const FOLLOW_UP_REMINDER_SENT_ACTION = 'whatsapp_follow_up_reminder_sent';
const FOLLOW_UP_REMINDER_SKIPPED_ACTION = 'whatsapp_follow_up_reminder_skipped';
const FOLLOW_UP_REMINDER_FAILED_ACTION = 'whatsapp_follow_up_reminder_failed';

export interface FollowUpReminderSummary {
  now: string;
  timezone: string;
  targetDate: string;
  lookaheadDays: number;
  dryRun: boolean;
  candidates: number;
  skippedAlreadyReminded: number;
  skippedMissingContact: number;
  matchedExistingBookings: number;
  possibleCalendarMatches: number;
  whatsappWouldSend: number;
  whatsappSent: number;
  whatsappFailed: number;
  markedBooked: number;
  markBookedFailed: number;
  calendarIdsScanned: number;
  calendarEventsScanned: number;
  errors: string[];
}

type FollowUpRow = {
  id: string;
  patient_user_id: string;
  suggested_date: string;
  reason: string | null;
  linked_booking_id: string | null;
  created_by: string;
};

type ProfileRow = {
  id: string;
  display_name: string | null;
  phone: string | null;
};

type BookingContactRow = {
  user_id: string | null;
  patient_name: string | null;
  phone: string | null;
  email: string | null;
  clinic_id: string | null;
  clinic_name_zh: string | null;
  created_at: string | null;
};

type BookingMatchRow = {
  id: string;
  google_event_id: string | null;
  patient_name: string | null;
  phone: string | null;
  phone_digits: string | null;
  appointment_date: string | null;
  appointment_time: string | null;
  source: string | null;
};

type CalendarScanResult = {
  calendarIdsScanned: number;
  calendarEventsScanned: number;
  events: Array<{ calendarId: string; event: any }>;
  errors: string[];
};

async function getAlreadyRemindedFollowUpIds(ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) {
    return new Set();
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('audit_logs')
    .select('entity_id')
    .eq('entity', 'follow_up_plans')
    .eq('action', FOLLOW_UP_REMINDER_SENT_ACTION)
    .in('entity_id', ids);

  if (error) {
    throw new Error(error.message);
  }

  return new Set(
    (data || [])
      .map((row) => (typeof row.entity_id === 'string' ? row.entity_id : ''))
      .filter(Boolean),
  );
}

async function listDueFollowUpRows(targetDate: string): Promise<FollowUpRow[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('follow_up_plans')
    .select('id, patient_user_id, suggested_date, reason, linked_booking_id, created_by')
    .eq('status', 'pending')
    .eq('suggested_date', targetDate)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data || []).map((row) => ({
    id: String(row.id || ''),
    patient_user_id: String(row.patient_user_id || ''),
    suggested_date: String(row.suggested_date || ''),
    reason: typeof row.reason === 'string' ? row.reason : null,
    linked_booking_id: typeof row.linked_booking_id === 'string' ? row.linked_booking_id : null,
    created_by: String(row.created_by || ''),
  }));
}

async function mapProfilesByUserId(userIds: string[]): Promise<Map<string, ProfileRow>> {
  if (userIds.length === 0) {
    return new Map();
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, phone')
    .in('id', userIds);

  if (error) {
    throw new Error(error.message);
  }

  return new Map(
    (data || []).map((row) => [
      String(row.id || ''),
      {
        id: String(row.id || ''),
        display_name: typeof row.display_name === 'string' ? row.display_name : null,
        phone: typeof row.phone === 'string' ? row.phone : null,
      },
    ]),
  );
}

async function mapLatestBookingContactByUserId(userIds: string[]): Promise<Map<string, BookingContactRow>> {
  if (userIds.length === 0) {
    return new Map();
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('booking_intake')
    .select('user_id, patient_name, phone, email, clinic_id, clinic_name_zh, created_at')
    .in('user_id', userIds)
    .order('created_at', { ascending: false })
    .limit(1000);

  if (error) {
    throw new Error(error.message);
  }

  const contacts = new Map<string, BookingContactRow>();
  for (const row of data || []) {
    const userId = typeof row.user_id === 'string' ? row.user_id : '';
    if (!userId || contacts.has(userId)) {
      continue;
    }

    contacts.set(userId, {
      user_id: userId,
      patient_name: typeof row.patient_name === 'string' ? row.patient_name : null,
      phone: typeof row.phone === 'string' ? row.phone : null,
      email: typeof row.email === 'string' ? row.email : null,
      clinic_id: typeof row.clinic_id === 'string' ? row.clinic_id : null,
      clinic_name_zh: typeof row.clinic_name_zh === 'string' ? row.clinic_name_zh : null,
      created_at: typeof row.created_at === 'string' ? row.created_at : null,
    });
  }

  return contacts;
}

async function listReminderCandidates(targetDate: string): Promise<{
  candidates: FollowUpReminderCandidate[];
  alreadyRemindedIds: Set<string>;
}> {
  const followUps = (await listDueFollowUpRows(targetDate)).filter(
    (row) => row.id && row.patient_user_id && !row.linked_booking_id,
  );
  const alreadyRemindedIds = await getAlreadyRemindedFollowUpIds(followUps.map((row) => row.id));
  const userIds = Array.from(new Set(followUps.map((row) => row.patient_user_id)));
  const [profilesByUserId, contactsByUserId] = await Promise.all([
    mapProfilesByUserId(userIds),
    mapLatestBookingContactByUserId(userIds),
  ]);

  const candidates = followUps.map((row) => {
    const profile = profilesByUserId.get(row.patient_user_id);
    const contact = contactsByUserId.get(row.patient_user_id);

    return {
      id: row.id,
      patientUserId: row.patient_user_id,
      createdBy: row.created_by,
      suggestedDate: row.suggested_date,
      reason: row.reason || '',
      patientName: (profile?.display_name || contact?.patient_name || '').trim(),
      patientPhone: (profile?.phone || contact?.phone || '').trim(),
      patientEmail: (contact?.email || '').trim().toLowerCase(),
      clinicId: (contact?.clinic_id || '').trim(),
      clinicNameZh: (contact?.clinic_name_zh || '醫天圓中醫診所').trim(),
    };
  });

  return { candidates, alreadyRemindedIds };
}

function toBookingPresenceFromIntake(row: BookingMatchRow, detail: string): BookingPresence {
  return {
    status: 'confirmed',
    source: 'booking_intake',
    bookingId: row.google_event_id || row.id,
    detail,
  };
}

async function findIntakeBookingPresence(params: {
  candidate: FollowUpReminderCandidate;
  startDate: string;
  endDate: string;
}): Promise<BookingPresence> {
  const supabase = createServiceClient();
  const { candidate, startDate, endDate } = params;

  const userResult = await supabase
    .from('booking_intake')
    .select('id, google_event_id, patient_name, phone, phone_digits, appointment_date, appointment_time, source')
    .eq('user_id', candidate.patientUserId)
    .in('status', ['pending', 'confirmed'])
    .gte('appointment_date', startDate)
    .lte('appointment_date', endDate)
    .order('appointment_date', { ascending: true })
    .order('appointment_time', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (userResult.error) {
    throw new Error(userResult.error.message);
  }

  if (userResult.data) {
    return toBookingPresenceFromIntake(
      userResult.data as BookingMatchRow,
      `booking_intake/${userResult.data.id}: user_id match`,
    );
  }

  const phoneVariants = getPhoneDigitVariants(candidate.patientPhone);
  if (phoneVariants.length > 0) {
    const phoneResult = await supabase
      .from('booking_intake')
      .select('id, google_event_id, patient_name, phone, phone_digits, appointment_date, appointment_time, source')
      .in('phone_digits', phoneVariants)
      .in('status', ['pending', 'confirmed'])
      .gte('appointment_date', startDate)
      .lte('appointment_date', endDate)
      .order('appointment_date', { ascending: true })
      .order('appointment_time', { ascending: true })
      .limit(20);

    if (phoneResult.error) {
      throw new Error(phoneResult.error.message);
    }

    const matched = (phoneResult.data || []).find((row) =>
      phoneDigitsMatch(
        typeof row.phone_digits === 'string' ? row.phone_digits : row.phone || '',
        candidate.patientPhone,
      ),
    );

    if (matched) {
      return toBookingPresenceFromIntake(
        matched as BookingMatchRow,
        `booking_intake/${matched.id}: phone match`,
      );
    }
  }

  return { status: 'none' };
}

async function scanCalendars(startDate: string, endDate: string): Promise<CalendarScanResult> {
  const start = fromZonedTime(`${startDate}T00:00:00`, HONG_KONG_TIMEZONE);
  const end = fromZonedTime(`${endDate}T23:59:59.999`, HONG_KONG_TIMEZONE);
  const calendarIds = await getActiveCalendarIds();
  const events: Array<{ calendarId: string; event: any }> = [];
  const errors: string[] = [];

  const results = await Promise.all(
    calendarIds.map(async (calendarId) => ({
      calendarId,
      result: await listEventsInRange(calendarId, start, end),
    })),
  );

  for (const { calendarId, result } of results) {
    if (!result.success) {
      errors.push(`${calendarId}: ${result.error || 'calendar list failed'}`);
      continue;
    }

    for (const event of result.events) {
      events.push({ calendarId, event });
    }
  }

  return {
    calendarIdsScanned: calendarIds.length,
    calendarEventsScanned: events.length,
    events,
    errors,
  };
}

async function writeFollowUpReminderAudit(params: {
  followUpId: string;
  patientUserId: string;
  actorUserId: string;
  action: string;
  payload: Record<string, unknown>;
}) {
  const supabase = createServiceClient();
  const { error } = await supabase.from('audit_logs').insert({
    actor_user_id: params.actorUserId,
    patient_user_id: params.patientUserId,
    entity: 'follow_up_plans',
    entity_id: params.followUpId,
    action: params.action,
    before_json: null,
    after_json: params.payload,
  });

  if (error) {
    throw new Error(error.message);
  }
}

async function markFollowUpBooked(params: {
  followUpId: string;
  patientUserId: string;
  actorUserId: string;
  bookingPresence: Extract<BookingPresence, { status: 'confirmed' }>;
}) {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from('follow_up_plans')
    .update({
      status: 'booked',
      linked_booking_id: params.bookingPresence.bookingId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.followUpId);

  if (error) {
    throw new Error(error.message);
  }

  await writeFollowUpReminderAudit({
    followUpId: params.followUpId,
    patientUserId: params.patientUserId,
    actorUserId: params.actorUserId,
    action: FOLLOW_UP_REMINDER_SKIPPED_ACTION,
    payload: {
      reason: 'confirmed_booking',
      source: params.bookingPresence.source,
      bookingId: params.bookingPresence.bookingId,
      detail: params.bookingPresence.detail,
    },
  });
}

export async function runFollowUpReminderJob(options: {
  targetDate?: string;
  lookaheadDays?: number;
  dryRun?: boolean;
  now?: Date;
}): Promise<FollowUpReminderSummary> {
  const now = options.now || new Date();
  const targetDate = options.targetDate || getTodayInHongKongDate(now);
  const lookaheadDays = options.lookaheadDays ?? DEFAULT_LOOKAHEAD_DAYS;
  const startDate = getTodayInHongKongDate(now);
  const endDate = addDateOnlyDays(targetDate, lookaheadDays);

  const summary: FollowUpReminderSummary = {
    now: now.toISOString(),
    timezone: HONG_KONG_TIMEZONE,
    targetDate,
    lookaheadDays,
    dryRun: Boolean(options.dryRun),
    candidates: 0,
    skippedAlreadyReminded: 0,
    skippedMissingContact: 0,
    matchedExistingBookings: 0,
    possibleCalendarMatches: 0,
    whatsappWouldSend: 0,
    whatsappSent: 0,
    whatsappFailed: 0,
    markedBooked: 0,
    markBookedFailed: 0,
    calendarIdsScanned: 0,
    calendarEventsScanned: 0,
    errors: [],
  };

  const { candidates, alreadyRemindedIds } = await listReminderCandidates(targetDate);
  summary.candidates = candidates.length;

  if (candidates.length === 0) {
    return summary;
  }

  const calendarScan = await scanCalendars(startDate, endDate);
  summary.calendarIdsScanned = calendarScan.calendarIdsScanned;
  summary.calendarEventsScanned = calendarScan.calendarEventsScanned;
  summary.errors.push(...calendarScan.errors.slice(0, 10));

  for (const candidate of candidates) {
    try {
      const alreadyReminded = alreadyRemindedIds.has(candidate.id);
      const intakePresence = await findIntakeBookingPresence({ candidate, startDate, endDate });
      const bookingPresence =
        intakePresence.status === 'none'
          ? findCalendarBookingPresence(candidate, calendarScan.events)
          : intakePresence;

      const decision = decideFollowUpReminder({
        alreadyReminded,
        hasContactPhone: Boolean(normalizePhoneForSearch(candidate.patientPhone)),
        bookingPresence,
      });

      if (decision.type === 'skip') {
        if (decision.reason === 'already_reminded') {
          summary.skippedAlreadyReminded += 1;
        } else if (decision.reason === 'missing_contact') {
          summary.skippedMissingContact += 1;
          if (!options.dryRun) {
            await writeFollowUpReminderAudit({
              followUpId: candidate.id,
              patientUserId: candidate.patientUserId,
              actorUserId: candidate.createdBy,
              action: FOLLOW_UP_REMINDER_SKIPPED_ACTION,
              payload: { reason: 'missing_contact' },
            });
          }
        } else if (decision.reason === 'confirmed_booking' && bookingPresence.status === 'confirmed') {
          summary.matchedExistingBookings += 1;
          if (!options.dryRun) {
            try {
              await markFollowUpBooked({
                followUpId: candidate.id,
                patientUserId: candidate.patientUserId,
                actorUserId: candidate.createdBy,
                bookingPresence,
              });
              summary.markedBooked += 1;
            } catch (error) {
              summary.markBookedFailed += 1;
              summary.errors.push(
                `${candidate.id}: failed to mark booked: ${error instanceof Error ? error.message : 'unknown error'}`,
              );
            }
          }
        } else if (decision.reason === 'possible_booking' && bookingPresence.status === 'possible') {
          summary.possibleCalendarMatches += 1;
          if (!options.dryRun) {
            await writeFollowUpReminderAudit({
              followUpId: candidate.id,
              patientUserId: candidate.patientUserId,
              actorUserId: candidate.createdBy,
              action: FOLLOW_UP_REMINDER_SKIPPED_ACTION,
              payload: {
                reason: 'possible_booking',
                source: bookingPresence.source,
                bookingId: bookingPresence.bookingId,
                detail: bookingPresence.detail,
              },
            });
          }
        }
        continue;
      }

      const note = buildFollowUpReminderNote({ suggestedDate: candidate.suggestedDate });
      if (options.dryRun) {
        summary.whatsappWouldSend += 1;
        continue;
      }

      const whatsappResult = await sendStaffPatientWhatsappMessage({
        patientName: candidate.patientName || '病人',
        phone: candidate.patientPhone,
        email: candidate.patientEmail,
        clinicNameZh: candidate.clinicNameZh || '醫天圓中醫診所',
        clinicWhatsappPhone: candidate.clinicId ? getClinicWhatsappPhone(candidate.clinicId) : null,
        purpose: 'follow_up',
        note,
        linkUrl: buildBookingUrl({ visitType: 'followup' }),
      });

      if (!whatsappResult.success) {
        summary.whatsappFailed += 1;
        await writeFollowUpReminderAudit({
          followUpId: candidate.id,
          patientUserId: candidate.patientUserId,
          actorUserId: candidate.createdBy,
          action: FOLLOW_UP_REMINDER_FAILED_ACTION,
          payload: {
            error: whatsappResult.error || 'send failed',
          },
        });
        continue;
      }

      summary.whatsappSent += 1;
      await writeFollowUpReminderAudit({
        followUpId: candidate.id,
        patientUserId: candidate.patientUserId,
        actorUserId: candidate.createdBy,
        action: FOLLOW_UP_REMINDER_SENT_ACTION,
        payload: {
          suggestedDate: candidate.suggestedDate,
          phoneDigits: normalizePhoneForSearch(candidate.patientPhone),
          conversationId: whatsappResult.conversationId || null,
          deliveryStatus: whatsappResult.deliveryStatus || null,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      summary.errors.push(`${candidate.id}: ${message}`);
    }
  }

  return summary;
}
