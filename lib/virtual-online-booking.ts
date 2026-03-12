import { formatInTimeZone, fromZonedTime, toZonedTime } from 'date-fns-tz';

import {
  getApplicableHolidaysForDate,
  getScheduleForDayFromWeekly,
  isSlotAvailableUtc,
  isSlotBlockedByHolidaysUtc,
} from '@/lib/booking-helpers';
import { getActiveScheduleMappings } from '@/lib/doctor-schedule-store';
import { getFreeBusy } from '@/lib/google-calendar';
import {
  PHYSICAL_CLINIC_IDS,
  type DoctorId,
  type PhysicalClinicId,
  isDoctorId,
} from '@/shared/clinic-data';
import type { CalendarMapping, TimeRange, WeeklySchedule } from '@/shared/schedule-config';

const HONG_KONG_TIMEZONE = 'Asia/Hong_Kong';
const SLOT_INCREMENT_MINUTES = 15;
const SAME_DAY_BUFFER_MINUTES = 60;

export type VirtualOnlineAvailability = {
  mappingFound: boolean;
  slots: string[];
  isClosed: boolean;
  isHoliday: boolean;
};

export type ResolvedOnlineSourceMapping =
  | { mapping: CalendarMapping; errorCode?: undefined }
  | { mapping?: undefined; errorCode: 'CALENDAR_UNAVAILABLE' | 'NOT_AVAILABLE' };

function isPhysicalClinicId(clinicId: string): clinicId is PhysicalClinicId {
  return PHYSICAL_CLINIC_IDS.includes(clinicId as PhysicalClinicId);
}

function createEmptyWeeklySchedule(): WeeklySchedule {
  return {
    0: null,
    1: null,
    2: null,
    3: null,
    4: null,
    5: null,
    6: null,
  };
}

function toMinutes(time: string): number {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
}

function mergeTimeRanges(ranges: TimeRange[]): TimeRange[] {
  if (ranges.length === 0) return [];

  const sorted = [...ranges].sort((left, right) => left.start.localeCompare(right.start));
  const merged: TimeRange[] = [{ ...sorted[0] }];

  for (const range of sorted.slice(1)) {
    const current = merged[merged.length - 1];
    if (toMinutes(range.start) <= toMinutes(current.end)) {
      if (range.end > current.end) {
        current.end = range.end;
      }
      continue;
    }

    merged.push({ ...range });
  }

  return merged;
}

function getRequestedDayContext(requestedDate: string) {
  const requestedDayUtc = fromZonedTime(`${requestedDate}T00:00:00`, HONG_KONG_TIMEZONE);
  const requestedDayInHk = toZonedTime(requestedDayUtc, HONG_KONG_TIMEZONE);
  const dayOfWeek = requestedDayInHk.getDay();

  return { requestedDayUtc, dayOfWeek };
}

function buildSlotBounds(requestedDate: string, time: string, durationMinutes: number) {
  const slotStart = fromZonedTime(`${requestedDate}T${time}:00`, HONG_KONG_TIMEZONE);
  const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60000);
  return { slotStart, slotEnd };
}

function mappingSupportsSlotTime(
  mapping: CalendarMapping,
  requestedDate: string,
  time: string,
  durationMinutes: number
): boolean {
  const { dayOfWeek } = getRequestedDayContext(requestedDate);
  const daySchedule = getScheduleForDayFromWeekly(mapping.schedule, dayOfWeek);
  if (!daySchedule || daySchedule.length === 0) {
    return false;
  }

  const slotStartMin = toMinutes(time);
  const slotEndMin = slotStartMin + durationMinutes;

  return daySchedule.some((range) => {
    const rangeStartMin = toMinutes(range.start);
    const rangeEndMin = toMinutes(range.end);
    return slotStartMin >= rangeStartMin && slotEndMin <= rangeEndMin;
  });
}

function isPastSameDayCutoff(requestedDate: string, slotStart: Date, nowUtc: Date): boolean {
  const todayInHk = formatInTimeZone(nowUtc, HONG_KONG_TIMEZONE, 'yyyy-MM-dd');
  if (requestedDate !== todayInHk) {
    return false;
  }

  const bookingCutoffUtc = new Date(nowUtc.getTime() + SAME_DAY_BUFFER_MINUTES * 60 * 1000);
  return slotStart < bookingCutoffUtc;
}

async function getPhysicalMappingsForDoctor(doctorId: DoctorId): Promise<CalendarMapping[]> {
  const mappings = await getActiveScheduleMappings();
  return mappings.filter(
    (mapping) => mapping.doctorId === doctorId && mapping.isActive && isPhysicalClinicId(mapping.clinicId)
  );
}

async function getAvailableSlotsForPhysicalMapping(params: {
  mapping: CalendarMapping;
  requestedDate: string;
  durationMinutes: number;
  nowUtc: Date;
}): Promise<VirtualOnlineAvailability> {
  const { mapping, requestedDate, durationMinutes, nowUtc } = params;
  const { requestedDayUtc, dayOfWeek } = getRequestedDayContext(requestedDate);
  const daySchedule = getScheduleForDayFromWeekly(mapping.schedule, dayOfWeek);

  if (!daySchedule || daySchedule.length === 0) {
    return {
      mappingFound: true,
      slots: [],
      isClosed: true,
      isHoliday: false,
    };
  }

  const applicableHolidays = await getApplicableHolidaysForDate(
    requestedDate,
    mapping.doctorId,
    mapping.clinicId
  );
  const isAllDayHoliday = applicableHolidays.some((holiday) => !holiday.startTime || !holiday.endTime);
  if (isAllDayHoliday) {
    return {
      mappingFound: true,
      slots: [],
      isClosed: true,
      isHoliday: true,
    };
  }

  const busySlots = await getFreeBusy(mapping.calendarId, requestedDayUtc);
  const availableSlots: string[] = [];

  for (const range of daySchedule) {
    let currentSlot = fromZonedTime(`${requestedDate}T${range.start}:00`, HONG_KONG_TIMEZONE);
    const rangeEnd = fromZonedTime(`${requestedDate}T${range.end}:00`, HONG_KONG_TIMEZONE);

    while (currentSlot < rangeEnd) {
      if (isPastSameDayCutoff(requestedDate, currentSlot, nowUtc)) {
        currentSlot = new Date(currentSlot.getTime() + SLOT_INCREMENT_MINUTES * 60 * 1000);
        continue;
      }

      const slotEnd = new Date(currentSlot.getTime() + durationMinutes * 60000);
      if (slotEnd > rangeEnd) {
        break;
      }

      if (
        isSlotAvailableUtc(currentSlot, slotEnd, busySlots) &&
        !isSlotBlockedByHolidaysUtc(currentSlot, slotEnd, applicableHolidays)
      ) {
        availableSlots.push(formatInTimeZone(currentSlot, HONG_KONG_TIMEZONE, 'HH:mm'));
      }

      currentSlot = new Date(currentSlot.getTime() + SLOT_INCREMENT_MINUTES * 60 * 1000);
    }
  }

  return {
    mappingFound: true,
    slots: availableSlots,
    isClosed: false,
    isHoliday: false,
  };
}

async function getOnlineCandidateMappingsForDate(
  doctorId: DoctorId,
  requestedDate: string
): Promise<CalendarMapping[]> {
  const physicalMappings = await getPhysicalMappingsForDoctor(doctorId);
  const { dayOfWeek } = getRequestedDayContext(requestedDate);

  return physicalMappings.filter((mapping) => {
    const daySchedule = getScheduleForDayFromWeekly(mapping.schedule, dayOfWeek);
    return Boolean(daySchedule && daySchedule.length > 0);
  });
}

function sortMappingsForSelection(
  mappings: CalendarMapping[],
  preferredCalendarId?: string
): CalendarMapping[] {
  return [...mappings].sort((left, right) => {
    if (preferredCalendarId) {
      if (left.calendarId === preferredCalendarId) return -1;
      if (right.calendarId === preferredCalendarId) return 1;
    }

    return PHYSICAL_CLINIC_IDS.indexOf(left.clinicId as PhysicalClinicId)
      - PHYSICAL_CLINIC_IDS.indexOf(right.clinicId as PhysicalClinicId);
  });
}

async function isMappingBookableForExactSlot(params: {
  mapping: CalendarMapping;
  requestedDate: string;
  time: string;
  durationMinutes: number;
  nowUtc: Date;
}): Promise<'bookable' | 'not_available' | 'calendar_unavailable'> {
  const { mapping, requestedDate, time, durationMinutes, nowUtc } = params;
  if (!mappingSupportsSlotTime(mapping, requestedDate, time, durationMinutes)) {
    return 'not_available';
  }

  const { slotStart, slotEnd } = buildSlotBounds(requestedDate, time, durationMinutes);
  if (isPastSameDayCutoff(requestedDate, slotStart, nowUtc)) {
    return 'not_available';
  }

  const applicableHolidays = await getApplicableHolidaysForDate(
    requestedDate,
    mapping.doctorId,
    mapping.clinicId
  );
  if (isSlotBlockedByHolidaysUtc(slotStart, slotEnd, applicableHolidays)) {
    return 'not_available';
  }

  try {
    const { requestedDayUtc } = getRequestedDayContext(requestedDate);
    const busySlots = await getFreeBusy(mapping.calendarId, requestedDayUtc);
    return isSlotAvailableUtc(slotStart, slotEnd, busySlots) ? 'bookable' : 'not_available';
  } catch {
    return 'calendar_unavailable';
  }
}

export function buildVirtualOnlineScheduleFromMappings(
  mappings: CalendarMapping[],
  doctorId: DoctorId
): WeeklySchedule | null {
  const physicalMappings = mappings.filter(
    (mapping) => mapping.doctorId === doctorId && mapping.isActive && isPhysicalClinicId(mapping.clinicId)
  );
  if (physicalMappings.length === 0) {
    return null;
  }

  const mergedSchedule = createEmptyWeeklySchedule();

  for (let day = 0; day <= 6; day += 1) {
    const allRanges = physicalMappings.flatMap((mapping) => mapping.schedule[day] ?? []);
    const mergedRanges = mergeTimeRanges(allRanges);
    mergedSchedule[day] = mergedRanges.length > 0 ? mergedRanges : null;
  }

  return mergedSchedule;
}

export async function getVirtualOnlineScheduleForDoctor(
  doctorId: DoctorId
): Promise<WeeklySchedule | null> {
  const mappings = await getActiveScheduleMappings();
  return buildVirtualOnlineScheduleFromMappings(mappings, doctorId);
}

export async function getVirtualOnlineAvailability(params: {
  doctorId: string;
  requestedDate: string;
  durationMinutes: number;
}): Promise<VirtualOnlineAvailability> {
  const { doctorId, requestedDate, durationMinutes } = params;
  if (!isDoctorId(doctorId)) {
    return {
      mappingFound: false,
      slots: [],
      isClosed: false,
      isHoliday: false,
    };
  }

  const candidateMappings = await getOnlineCandidateMappingsForDate(doctorId, requestedDate);
  if (candidateMappings.length === 0) {
    const hasAnyPhysicalMapping = (await getPhysicalMappingsForDoctor(doctorId)).length > 0;
    return {
      mappingFound: hasAnyPhysicalMapping,
      slots: [],
      isClosed: hasAnyPhysicalMapping,
      isHoliday: false,
    };
  }

  const nowUtc = new Date();
  const results = await Promise.all(
    candidateMappings.map((mapping) =>
      getAvailableSlotsForPhysicalMapping({
        mapping,
        requestedDate,
        durationMinutes,
        nowUtc,
      })
    )
  );

  const slots = Array.from(new Set(results.flatMap((result) => result.slots))).sort((left, right) =>
    left.localeCompare(right)
  );
  if (slots.length > 0) {
    return {
      mappingFound: true,
      slots,
      isClosed: false,
      isHoliday: false,
    };
  }

  const everyCandidateBlockedByHoliday = results.every((result) => result.isClosed && result.isHoliday);
  return {
    mappingFound: true,
    slots: [],
    isClosed: everyCandidateBlockedByHoliday,
    isHoliday: everyCandidateBlockedByHoliday,
  };
}

export async function resolveOnlineSourceMappingForSlot(params: {
  doctorId: string;
  requestedDate: string;
  time: string;
  durationMinutes: number;
  preferredCalendarId?: string;
}): Promise<ResolvedOnlineSourceMapping> {
  const { doctorId, requestedDate, time, durationMinutes, preferredCalendarId } = params;
  if (!isDoctorId(doctorId)) {
    return { errorCode: 'NOT_AVAILABLE' };
  }

  const candidateMappings = await getOnlineCandidateMappingsForDate(doctorId, requestedDate);
  const slotCandidates = sortMappingsForSelection(
    candidateMappings.filter((mapping) => mappingSupportsSlotTime(mapping, requestedDate, time, durationMinutes)),
    preferredCalendarId
  );

  if (slotCandidates.length === 0) {
    return { errorCode: 'NOT_AVAILABLE' };
  }

  const nowUtc = new Date();
  let sawCalendarUnavailable = false;

  for (const mapping of slotCandidates) {
    const status = await isMappingBookableForExactSlot({
      mapping,
      requestedDate,
      time,
      durationMinutes,
      nowUtc,
    });

    if (status === 'bookable') {
      return { mapping };
    }

    if (status === 'calendar_unavailable') {
      sawCalendarUnavailable = true;
    }
  }

  return sawCalendarUnavailable
    ? { errorCode: 'CALENDAR_UNAVAILABLE' }
    : { errorCode: 'NOT_AVAILABLE' };
}
