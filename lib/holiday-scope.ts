import {
  DOCTORS,
  isClinicId,
  isDoctorId,
  type ClinicId,
  type DoctorId,
  type DoctorProfile,
} from '@/shared/clinic-data';

/**
 * Explicit "applies to everyone" choice for a holiday's doctor or clinic scope.
 * Stored in the database as NULL; on the wire it must be sent as this sentinel so
 * the API can tell "staff chose all" apart from "staff did not choose".
 */
export const HOLIDAY_SCOPE_ALL = 'all' as const;

export type HolidayScopeKind = 'doctor' | 'clinic';
export type HolidayDoctorScope = DoctorId | typeof HOLIDAY_SCOPE_ALL | '';
export type HolidayClinicScope = ClinicId | typeof HOLIDAY_SCOPE_ALL | '';

const SCOPE_LABELS: Record<HolidayScopeKind, { missing: string; all: string }> = {
  doctor: { missing: '請選擇醫師（或「全部醫師」）', all: '全部醫師' },
  clinic: { missing: '請選擇診所（或「全部診所」）', all: '全部診所' },
};

export class HolidayScopeError extends Error {
  readonly kind: HolidayScopeKind;

  constructor(kind: HolidayScopeKind, message: string) {
    super(message);
    this.name = 'HolidayScopeError';
    this.kind = kind;
  }
}

/**
 * Parses a doctorId / clinicId from an API request body.
 * - `"all"` -> null (explicitly everyone)
 * - a valid id -> that id
 * - missing / null / "" -> HolidayScopeError (scope not chosen)
 */
export function parseHolidayScopeInput(raw: unknown, kind: HolidayScopeKind): string | null {
  if (raw === null || raw === undefined) {
    throw new HolidayScopeError(kind, SCOPE_LABELS[kind].missing);
  }
  if (typeof raw !== 'string') {
    throw new HolidayScopeError(kind, `${kind}Id must be a string`);
  }

  const value = raw.trim();
  if (!value) {
    throw new HolidayScopeError(kind, SCOPE_LABELS[kind].missing);
  }
  if (value === HOLIDAY_SCOPE_ALL) return null;
  if (kind === 'doctor' && !isDoctorId(value)) {
    throw new HolidayScopeError(kind, 'Invalid doctorId');
  }
  if (kind === 'clinic' && !isClinicId(value)) {
    throw new HolidayScopeError(kind, 'Invalid clinicId');
  }
  return value;
}

/** Converts a stored (nullable) id back to a form scope value. */
export function toHolidayScopeValue<T extends string>(storedId: T | null | undefined): T | typeof HOLIDAY_SCOPE_ALL {
  return storedId ? storedId : HOLIDAY_SCOPE_ALL;
}

const TITLE_SUFFIXES = ['醫師', '醫生', '脊醫'] as const;

function stripTitle(nameZh: string): string {
  for (const suffix of TITLE_SUFFIXES) {
    if (nameZh.endsWith(suffix)) return nameZh.slice(0, -suffix.length);
  }
  return nameZh;
}

/** Names staff are likely to type for a doctor, e.g. 張敏言醫師 / 張敏言 / 張醫師 / 敏言醫師 / Dr. Cheung. */
export function getDoctorNameAliases(doctor: Pick<DoctorProfile, 'nameZh' | 'nameEn'>): string[] {
  const aliases = new Set<string>();
  const fullName = doctor.nameZh.trim();
  const baseName = stripTitle(fullName);

  aliases.add(fullName);
  if (baseName.length >= 2) {
    aliases.add(baseName);
    const surname = baseName.slice(0, 1);
    const givenName = baseName.slice(1);
    for (const suffix of TITLE_SUFFIXES) {
      aliases.add(`${surname}${suffix}`);
      if (givenName.length >= 2) aliases.add(`${givenName}${suffix}`);
    }
  }

  const english = doctor.nameEn.trim().toLowerCase();
  if (english) aliases.add(english);

  return [...aliases];
}

/** Returns the doctors whose name (any alias) appears in the free-text reason. */
export function findDoctorsNamedInReason(
  reason: string,
  doctors: ReadonlyArray<Pick<DoctorProfile, 'id' | 'nameZh' | 'nameEn'>> = DOCTORS
): DoctorId[] {
  const text = reason.trim();
  if (!text) return [];
  const lower = text.toLowerCase();

  return doctors
    .filter((doctor) =>
      getDoctorNameAliases(doctor).some((alias) => (/[a-z]/.test(alias) ? lower.includes(alias) : text.includes(alias)))
    )
    .map((doctor) => doctor.id);
}

export type HolidayScopeReview = {
  /** Scopes the staff member has not chosen yet; saving must be blocked. */
  missing: HolidayScopeKind[];
  /** All doctors AND all clinics: every booking that day is blocked. */
  isNetworkWide: boolean;
  /** Doctors named in the reason while the doctor scope is "all"; likely a wrong scope. */
  doctorsNamedWithAllScope: DoctorId[];
  /** True when saving needs an explicit confirmation step. */
  needsConfirmation: boolean;
};

export function reviewHolidayScope(input: {
  doctorScope: string;
  clinicScope: string;
  reason: string;
}): HolidayScopeReview {
  const missing: HolidayScopeKind[] = [];
  if (!input.doctorScope.trim()) missing.push('doctor');
  if (!input.clinicScope.trim()) missing.push('clinic');

  const doctorIsAll = input.doctorScope === HOLIDAY_SCOPE_ALL;
  const clinicIsAll = input.clinicScope === HOLIDAY_SCOPE_ALL;
  const isNetworkWide = doctorIsAll && clinicIsAll;
  const doctorsNamedWithAllScope = doctorIsAll ? findDoctorsNamedInReason(input.reason) : [];

  return {
    missing,
    isNetworkWide,
    doctorsNamedWithAllScope,
    needsConfirmation: missing.length === 0 && (isNetworkWide || doctorsNamedWithAllScope.length > 0),
  };
}

export function isNetworkWideHoliday(item: { doctorId: string | null; clinicId: string | null }): boolean {
  return !item.doctorId && !item.clinicId;
}

/**
 * True when Supabase/PostgREST reports that the `created_by` audit columns are not
 * deployed yet (migration 20261021120000 not applied). Callers retry without them.
 */
export function isMissingHolidayAuditColumnError(error: unknown): boolean {
  const message =
    typeof error === 'object' && error && 'message' in error && typeof error.message === 'string'
      ? error.message
      : error instanceof Error
        ? error.message
        : String(error);

  const normalized = message.toLowerCase();
  return normalized.includes('created_by') && (normalized.includes('column') || normalized.includes('schema cache'));
}
