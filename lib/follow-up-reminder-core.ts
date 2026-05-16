import { formatInTimeZone } from 'date-fns-tz';

import { normalizePhoneForSearch } from '@/lib/contact-utils';
import { buildBookingUrl } from '@/lib/public-url';

export const HONG_KONG_TIMEZONE = 'Asia/Hong_Kong';

export type FollowUpReminderDecision =
  | { type: 'send' }
  | { type: 'skip'; reason: 'already_reminded' | 'missing_contact' | 'confirmed_booking' | 'possible_booking' };

export type BookingPresence =
  | {
      status: 'confirmed';
      source: 'booking_intake' | 'google_calendar';
      bookingId: string;
      detail: string;
    }
  | {
      status: 'possible';
      source: 'google_calendar';
      bookingId: string;
      detail: string;
    }
  | { status: 'none' };

export interface FollowUpReminderCandidate {
  id: string;
  patientUserId: string;
  createdBy: string;
  suggestedDate: string;
  reason: string;
  patientName: string;
  patientPhone: string;
  patientEmail: string;
  clinicId: string;
  clinicNameZh: string;
}

export function getTodayInHongKongDate(now = new Date()): string {
  return formatInTimeZone(now, HONG_KONG_TIMEZONE, 'yyyy-MM-dd');
}

export function addDateOnlyDays(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    return date;
  }

  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

export function getPhoneDigitVariants(phone: string): string[] {
  const digits = normalizePhoneForSearch(phone);
  if (!digits) {
    return [];
  }

  const variants = new Set<string>([digits]);
  if (digits.startsWith('852') && digits.length === 11) {
    variants.add(digits.slice(3));
  }
  if (digits.length === 8) {
    variants.add(`852${digits}`);
  }

  return [...variants];
}

export function phoneDigitsMatch(left: string, right: string): boolean {
  const leftVariants = getPhoneDigitVariants(left);
  const rightVariants = new Set(getPhoneDigitVariants(right));
  return leftVariants.some((variant) => rightVariants.has(variant));
}

function normalizeComparableName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\p{Script=Han}\p{Letter}\p{Number}]+/gu, '');
}

function eventText(event: any): string {
  return [
    event?.summary,
    event?.description,
    event?.location,
    event?.extendedProperties?.private
      ? Object.values(event.extendedProperties.private).join(' ')
      : '',
  ]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join('\n');
}

function eventMatchesPhone(event: any, phone: string): boolean {
  const digits = normalizePhoneForSearch(eventText(event));
  if (!digits || !phone) return false;

  return getPhoneDigitVariants(phone).some((variant) => digits.includes(variant));
}

function eventMatchesName(event: any, patientName: string): boolean {
  const normalizedName = normalizeComparableName(patientName);
  if (normalizedName.length < 2) return false;

  return normalizeComparableName(eventText(event)).includes(normalizedName);
}

export function findCalendarBookingPresence(
  candidate: Pick<FollowUpReminderCandidate, 'patientName' | 'patientPhone'>,
  events: Array<{ calendarId: string; event: any }>,
): BookingPresence {
  for (const { calendarId, event } of events) {
    if (event?.status === 'cancelled') {
      continue;
    }

    const eventId = typeof event?.id === 'string' ? event.id : '';
    if (!eventId) {
      continue;
    }

    if (candidate.patientPhone && eventMatchesPhone(event, candidate.patientPhone)) {
      return {
        status: 'confirmed',
        source: 'google_calendar',
        bookingId: eventId,
        detail: `${calendarId}/${eventId}: phone match`,
      };
    }
  }

  for (const { calendarId, event } of events) {
    if (event?.status === 'cancelled') {
      continue;
    }

    const eventId = typeof event?.id === 'string' ? event.id : '';
    if (!eventId) {
      continue;
    }

    if (candidate.patientName && eventMatchesName(event, candidate.patientName)) {
      return {
        status: 'possible',
        source: 'google_calendar',
        bookingId: eventId,
        detail: `${calendarId}/${eventId}: name-only match`,
      };
    }
  }

  return { status: 'none' };
}

export function buildFollowUpReminderNote(input: {
  suggestedDate: string;
  bookingUrl?: string;
}): string {
  const bookingUrl = input.bookingUrl || buildBookingUrl({ visitType: 'followup' });
  return `醫師建議你於 ${input.suggestedDate} 附近安排覆診。如仍未預約，可按此選擇時間：${bookingUrl}`;
}

export function decideFollowUpReminder(params: {
  alreadyReminded: boolean;
  hasContactPhone: boolean;
  bookingPresence: BookingPresence;
}): FollowUpReminderDecision {
  if (params.alreadyReminded) {
    return { type: 'skip', reason: 'already_reminded' };
  }

  if (params.bookingPresence.status === 'confirmed') {
    return { type: 'skip', reason: 'confirmed_booking' };
  }

  if (params.bookingPresence.status === 'possible') {
    return { type: 'skip', reason: 'possible_booking' };
  }

  if (!params.hasContactPhone) {
    return { type: 'skip', reason: 'missing_contact' };
  }

  return { type: 'send' };
}
