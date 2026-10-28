import { bookingText, type BookingLocale } from '@/shared/booking-locale';
export type AvailabilityState = 'available' | 'unavailable' | 'unknown';

export type AvailabilityByDate<Clinic extends string> = Record<
  string,
  Partial<Record<Clinic, AvailabilityState>>
>;

export type EarliestAvailabilitySummary = {
  label: string;
  tone: 'available' | 'unavailable' | 'loading' | 'unknown';
};

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Inclusive list of calendar dates (YYYY-MM-DD) between two Hong Kong calendar dates.
 * Pure string/UTC arithmetic so the result does not depend on the runtime timezone.
 */
export function bookingDatesBetween(minDate: string, maxDate: string): string[] {
  if (!ISO_DATE_PATTERN.test(minDate) || !ISO_DATE_PATTERN.test(maxDate)) return [];

  const dates: string[] = [];
  const cursor = new Date(`${minDate}T00:00:00Z`);
  if (Number.isNaN(cursor.getTime())) return [];

  while (cursor.toISOString().slice(0, 10) <= maxDate) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

export function formatDayMonth(dateIso: string): string {
  const [, month, day] = dateIso.split('-');
  return `${Number(day)}/${Number(month)}`;
}

/**
 * Earliest bookable date across the whole booking window (not limited to the shown month).
 * Dates must be sorted ascending. An earlier date that is still loading or failed (unknown)
 * blocks a later available date from being claimed as the earliest.
 */
export function earliestAvailabilitySummary(
  dates: string[],
  stateForDate: (date: string) => AvailabilityState | undefined,
  loading: boolean,
  locale: BookingLocale = 'zh',
): EarliestAvailabilitySummary {
  let hasUnresolvedEarlierDate = false;

  for (const date of dates) {
    const state = stateForDate(date);
    if (state === 'unavailable') continue;

    if (state === 'available') {
      if (hasUnresolvedEarlierDate) break;
      return { label: bookingText('最早 {0}/{1} 可約', locale, [Number(date.slice(8,10)), Number(date.slice(5,7))]), tone: 'available' };
    }

    hasUnresolvedEarlierDate = true;
    // Still scanning: the first unresolved date decides the answer, no need to look further.
    if (loading) break;
  }

  if (loading) return { label: bookingText('正在查詢最早時段', locale), tone: 'loading' };
  if (dates.length === 0 || hasUnresolvedEarlierDate) {
    return { label: bookingText('暫時未能確認最早時段', locale), tone: 'unknown' };
  }
  return { label: bookingText('可預約日期內暫無時段', locale), tone: 'unavailable' };
}

type ScanJob<Clinic extends string> = { date: string; clinic: Clinic; priority: boolean };

/**
 * Scans availability for every clinic across the booking window with bounded concurrency.
 *
 * - Priority dates (the month shown in the calendar) are always scanned, first.
 * - Other dates are scanned only until each clinic's earliest available date is known:
 *   once a clinic has an available date, later non-priority dates for it are skipped.
 * - Dates already known as available/unavailable are not requested again; unknown is retried.
 */
export async function scanBookingOverview<Clinic extends string>(params: {
  dates: string[];
  clinics: Clinic[];
  request: (date: string, clinic: Clinic) => Promise<AvailabilityState>;
  isCancelled: () => boolean;
  isPriorityDate?: (date: string) => boolean;
  known?: AvailabilityByDate<Clinic>;
  concurrency?: number;
  onResult?: (date: string, clinic: Clinic, state: AvailabilityState) => void;
  onPriorityComplete?: () => void;
}): Promise<AvailabilityByDate<Clinic>> {
  const known = params.known ?? {};
  const isPriorityDate = params.isPriorityDate ?? (() => false);
  const sortedDates = [...params.dates].sort();
  const result: AvailabilityByDate<Clinic> = {};
  const earliestFound = new Map<Clinic, string>();

  const recordFound = (clinic: Clinic, date: string) => {
    const current = earliestFound.get(clinic);
    if (!current || date < current) earliestFound.set(clinic, date);
  };

  for (const date of sortedDates) {
    for (const clinic of params.clinics) {
      const state = known[date]?.[clinic];
      if (!state) continue;
      result[date] = { ...result[date], [clinic]: state };
      if (state === 'available') recordFound(clinic, date);
    }
  }

  const priorityJobs: ScanJob<Clinic>[] = [];
  const otherJobs: ScanJob<Clinic>[] = [];
  for (const date of sortedDates) {
    const priority = isPriorityDate(date);
    for (const clinic of params.clinics) {
      const state = known[date]?.[clinic];
      if (state === 'available' || state === 'unavailable') continue;
      (priority ? priorityJobs : otherJobs).push({ date, clinic, priority });
    }
  }

  const queue = [...priorityJobs, ...otherJobs];
  let pendingPriority = priorityJobs.length;
  let priorityReported = false;
  const reportPriorityIfDone = () => {
    if (!priorityReported && pendingPriority === 0 && !params.isCancelled()) {
      priorityReported = true;
      params.onPriorityComplete?.();
    }
  };
  reportPriorityIfDone();

  const shouldSkip = (job: ScanJob<Clinic>) => {
    if (job.priority) return false;
    const found = earliestFound.get(job.clinic);
    return Boolean(found && job.date > found);
  };

  const workerCount = Math.min(Math.max(1, params.concurrency ?? 6), queue.length);
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (queue.length > 0 && !params.isCancelled()) {
        const job = queue.shift();
        if (!job) break;
        if (shouldSkip(job)) continue;

        let state: AvailabilityState;
        try {
          state = await params.request(job.date, job.clinic);
        } catch {
          state = 'unknown';
        }
        if (params.isCancelled()) break;

        result[job.date] = { ...result[job.date], [job.clinic]: state };
        if (state === 'available') recordFound(job.clinic, job.date);
        params.onResult?.(job.date, job.clinic, state);

        if (job.priority) {
          pendingPriority -= 1;
          reportPriorityIfDone();
        }
      }
    })
  );

  return result;
}
