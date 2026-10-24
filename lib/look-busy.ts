import { formatInTimeZone } from 'date-fns-tz';

/**
 * Smart "look busy" for patient-facing availability (display only).
 *
 * Acuity hides a flat share of free slots. This version hides more when a
 * doctor's day is quiet, less or nothing when it is busy, and nothing close
 * to the date. It never blocks booking a hidden slot at create time.
 */

export const LOOK_BUSY_CONFIG = {
  /** Env var for the global kill switch. Unset = on. */
  envVar: 'LOOK_BUSY_ENABLED',
  /**
   * Occupancy tiers, checked in order. Occupancy = calendar-busy in-session
   * slots / all in-session slots for that doctor x clinic x date.
   * Occupancy >= the last `belowOccupancy` hides nothing.
   */
  tiers: [
    { belowOccupancy: 0.3, hideRatio: 0.3 },
    { belowOccupancy: 0.6, hideRatio: 0.15 },
  ],
  /**
   * Upper bound on the hide ratio per weekday (0 = Sunday .. 6 = Saturday),
   * for days that are usually busy. Weekdays not listed use the tier ratio.
   */
  maxHideRatioByWeekday: { 6: 0.15 } as Readonly<Partial<Record<number, number>>>,
  /** Each session (schedule range) keeps at least min(this, offered slots in that session). */
  minVisiblePerSession: 5,
  /**
   * Near dates: dates within this many calendar days of today (HK) use the
   * lighter `nearDateTiers` instead of `tiers`. 2 = today, tomorrow and the
   * day after.
   */
  releaseWithinDays: 2,
  /** Lighter tiers for near dates; occupancy at or above the last bound hides nothing. */
  nearDateTiers: [{ belowOccupancy: 0.3, hideRatio: 0.15 }],
  timeZone: 'Asia/Hong_Kong',
} as const;

export type LookBusyConfig = {
  tiers: ReadonlyArray<{ belowOccupancy: number; hideRatio: number }>;
  maxHideRatioByWeekday: Readonly<Partial<Record<number, number>>>;
  nearDateTiers: ReadonlyArray<{ belowOccupancy: number; hideRatio: number }>;
  minVisiblePerSession: number;
  releaseWithinDays: number;
  timeZone: string;
};

/** One slot on the day's in-session grid. */
export type LookBusyGridSlot = {
  /** HH:mm (Hong Kong). */
  time: string;
  /** Index of the schedule range (session) this slot belongs to. */
  session: number;
  /**
   * free     = not blocked by Google Calendar busy time
   * busy     = blocked by Google Calendar busy time
   * excluded = removed by a partial-day holiday; ignored for occupancy
   */
  status: 'free' | 'busy' | 'excluded';
};

export type LookBusyInput = {
  doctorId: string;
  clinicId: string;
  /** YYYY-MM-DD (Hong Kong). */
  date: string;
  slotMinutes: number;
  /** Full in-session grid for the day, independent of time-of-day rules. */
  grid: LookBusyGridSlot[];
  /** Slots that would be shown without look-busy (after time rules), HH:mm. */
  offeredSlots: string[];
  now: Date;
  /** Global switch AND per-doctor switch AND not staff. */
  enabled: boolean;
};

export type LookBusySkipReason =
  | 'disabled'
  | 'near_date'
  | 'no_grid'
  | 'busy_day'
  | 'nothing_to_hide';

export type LookBusyResult = {
  visibleSlots: string[];
  hiddenSlots: string[];
  occupancy: number | null;
  hideRatio: number;
  skipped?: LookBusySkipReason;
};

const FALSE_VALUES = new Set(['0', 'false', 'off', 'no', 'disabled']);

export function isLookBusyGloballyEnabled(
  env: Record<string, string | undefined> = process.env
): boolean {
  const raw = env[LOOK_BUSY_CONFIG.envVar];
  if (raw === undefined) return true;
  const normalized = raw.trim().toLowerCase();
  if (normalized === '') return true;
  return !FALSE_VALUES.has(normalized);
}

/** FNV-1a 32-bit. Stable across runtimes; used only for deterministic tie-breaks. */
export function stableHash(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function toMinutes(time: string): number {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
}

function addDaysIso(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  const value = new Date(Date.UTC(year, month - 1, day + days));
  return value.toISOString().slice(0, 10);
}

export function isWithinNearDateRelease(
  date: string,
  now: Date,
  config: Pick<LookBusyConfig, 'releaseWithinDays' | 'timeZone'> = LOOK_BUSY_CONFIG
): boolean {
  const todayHk = formatInTimeZone(now, config.timeZone, 'yyyy-MM-dd');
  const lastReleasedDate = addDaysIso(todayHk, config.releaseWithinDays);
  return date <= lastReleasedDate;
}

export function computeOccupancy(grid: LookBusyGridSlot[]): number | null {
  let busy = 0;
  let total = 0;
  for (const slot of grid) {
    if (slot.status === 'excluded') continue;
    total += 1;
    if (slot.status === 'busy') busy += 1;
  }
  return total === 0 ? null : busy / total;
}

export function getHideRatioForOccupancy(
  occupancy: number,
  config: Pick<LookBusyConfig, 'tiers'> = LOOK_BUSY_CONFIG
): number {
  return ratioFromTiers(occupancy, config.tiers);
}

function ratioFromTiers(
  occupancy: number,
  tiers: ReadonlyArray<{ belowOccupancy: number; hideRatio: number }>
): number {
  for (const tier of tiers) {
    if (occupancy < tier.belowOccupancy) return tier.hideRatio;
  }
  return 0;
}

/** Weekday of a YYYY-MM-DD calendar date, 0 = Sunday .. 6 = Saturday. */
export function weekdayOfIsoDate(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function getHideRatio(
  occupancy: number,
  date: string,
  config: Pick<LookBusyConfig, 'tiers' | 'nearDateTiers' | 'maxHideRatioByWeekday'> = LOOK_BUSY_CONFIG,
  nearDate = false
): number {
  const tierRatio = ratioFromTiers(occupancy, nearDate ? config.nearDateTiers : config.tiers);
  const cap = config.maxHideRatioByWeekday[weekdayOfIsoDate(date)];
  return cap === undefined ? tierRatio : Math.min(tierRatio, cap);
}

export function applyLookBusy(
  input: LookBusyInput,
  config: LookBusyConfig = LOOK_BUSY_CONFIG
): LookBusyResult {
  const offered = input.offeredSlots;
  const keepAll = (
    skipped: LookBusySkipReason,
    occupancy: number | null = null,
    hideRatio = 0
  ): LookBusyResult => ({ visibleSlots: [...offered], hiddenSlots: [], occupancy, hideRatio, skipped });

  if (!input.enabled) return keepAll('disabled');
  const nearDate = isWithinNearDateRelease(input.date, input.now, config);

  const occupancy = computeOccupancy(input.grid);
  if (occupancy === null) return keepAll('no_grid');

  const hideRatio = getHideRatio(occupancy, input.date, config, nearDate);
  if (hideRatio <= 0) return keepAll(nearDate ? 'near_date' : 'busy_day', occupancy, hideRatio);

  const targetHide = Math.round(offered.length * hideRatio);
  if (targetHide <= 0) return keepAll('nothing_to_hide', occupancy, hideRatio);

  const gridByMinute = new Map<number, LookBusyGridSlot>();
  for (const slot of input.grid) gridByMinute.set(toMinutes(slot.time), slot);

  const slotMinutes = input.slotMinutes > 0 ? input.slotMinutes : 15;
  const busyMinutes = input.grid.filter((slot) => slot.status === 'busy').map((slot) => toMinutes(slot.time));

  // Session of each offered slot; slots not on the grid get their own bucket.
  const offeredInSession = new Map<number, number>();
  const candidates = offered.map((time) => {
    const minute = toMinutes(time);
    const session = gridByMinute.get(minute)?.session ?? -1;
    offeredInSession.set(session, (offeredInSession.get(session) ?? 0) + 1);
    // Adjacent = a calendar-busy grid slot starts within one slot length.
    const adjacent = busyMinutes.some((busy) => busy !== minute && Math.abs(busy - minute) <= slotMinutes);
    const hash = stableHash(`${input.doctorId}|${input.clinicId}|${input.date}|${time}`);
    return { time, session, adjacent, hash };
  });

  const hideBudgetBySession = new Map<number, number>();
  for (const [session, count] of offeredInSession) {
    hideBudgetBySession.set(session, count - Math.min(config.minVisiblePerSession, count));
  }

  // Hide isolated slots first, then adjacent ones; stable hash breaks ties.
  const order = [...candidates].sort((left, right) => {
    if (left.adjacent !== right.adjacent) return left.adjacent ? 1 : -1;
    if (left.hash !== right.hash) return left.hash - right.hash;
    return left.time.localeCompare(right.time);
  });

  const hidden = new Set<string>();
  for (const candidate of order) {
    if (hidden.size >= targetHide) break;
    const budget = hideBudgetBySession.get(candidate.session) ?? 0;
    if (budget <= 0) continue;
    hidden.add(candidate.time);
    hideBudgetBySession.set(candidate.session, budget - 1);
  }

  return {
    visibleSlots: offered.filter((time) => !hidden.has(time)),
    hiddenSlots: offered.filter((time) => hidden.has(time)),
    occupancy,
    hideRatio,
  };
}
