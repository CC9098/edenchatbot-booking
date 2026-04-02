import assert from 'node:assert/strict';
import test from 'node:test';

import type { Holiday } from '@/shared/schema';
import { mergeHolidayRows } from '@/lib/holiday-store';

function buildHoliday(overrides: Partial<Holiday> = {}): Holiday {
  return {
    id: overrides.id ?? 'holiday-1',
    doctorId: overrides.doctorId ?? 'chan',
    clinicId: overrides.clinicId ?? null,
    holidayDate: overrides.holidayDate ?? '2026-04-02',
    startTime: overrides.startTime ?? null,
    endTime: overrides.endTime ?? null,
    reason: overrides.reason ?? '放假',
  };
}

test('mergeHolidayRows dedupes the same holiday returned by multiple stores', () => {
  const supabaseHoliday = buildHoliday({ id: 'supabase-1' });
  const legacyHoliday = buildHoliday({ id: 'legacy-1' });

  const merged = mergeHolidayRows([supabaseHoliday], [legacyHoliday]);

  assert.equal(merged.length, 1);
  assert.equal(merged[0]?.id, 'supabase-1');
});

test('mergeHolidayRows preserves distinct holidays with different scopes or times', () => {
  const allDayDoctorHoliday = buildHoliday({ id: 'all-day', clinicId: null });
  const clinicOnlyPartialHoliday = buildHoliday({
    id: 'partial',
    clinicId: 'central',
    startTime: '15:30',
    endTime: '19:30',
  });

  const merged = mergeHolidayRows([allDayDoctorHoliday], [clinicOnlyPartialHoliday]);

  assert.equal(merged.length, 2);
});
