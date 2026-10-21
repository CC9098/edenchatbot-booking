import assert from 'node:assert/strict';
import test from 'node:test';

import {
  HOLIDAY_SCOPE_ALL,
  HolidayScopeError,
  findDoctorsNamedInReason,
  isMissingHolidayAuditColumnError,
  isNetworkWideHoliday,
  parseHolidayScopeInput,
  reviewHolidayScope,
  toHolidayScopeValue,
} from '@/lib/holiday-scope';

test('not-chosen scope is rejected by the API parser', () => {
  for (const raw of [undefined, null, '', '   ']) {
    assert.throws(() => parseHolidayScopeInput(raw, 'doctor'), HolidayScopeError);
    assert.throws(() => parseHolidayScopeInput(raw, 'clinic'), HolidayScopeError);
  }
});

test('explicit all maps to NULL; valid ids pass; unknown ids fail', () => {
  assert.equal(parseHolidayScopeInput(HOLIDAY_SCOPE_ALL, 'doctor'), null);
  assert.equal(parseHolidayScopeInput('all', 'clinic'), null);
  assert.equal(parseHolidayScopeInput('cheungmy', 'doctor'), 'cheungmy');
  assert.equal(parseHolidayScopeInput(' jordan ', 'clinic'), 'jordan');
  assert.throws(() => parseHolidayScopeInput('nobody', 'doctor'), /Invalid doctorId/);
  assert.throws(() => parseHolidayScopeInput(42, 'clinic'), HolidayScopeError);
});

test('not-chosen scope in the form is reported as missing and never needs confirmation', () => {
  const review = reviewHolidayScope({ doctorScope: '', clinicScope: '', reason: '張敏言醫師休息。' });
  assert.deepEqual(review.missing, ['doctor', 'clinic']);
  assert.equal(review.needsConfirmation, false);

  const partial = reviewHolidayScope({ doctorScope: 'cheungmy', clinicScope: '', reason: '' });
  assert.deepEqual(partial.missing, ['clinic']);
});

test('explicit all doctors + all clinics is allowed but flagged as network-wide', () => {
  const review = reviewHolidayScope({ doctorScope: 'all', clinicScope: 'all', reason: '員工活動日，全線休息一日' });
  assert.deepEqual(review.missing, []);
  assert.equal(review.isNetworkWide, true);
  assert.deepEqual(review.doctorsNamedWithAllScope, []);
  assert.equal(review.needsConfirmation, true);
});

test('the 2026-09-18 incident: reason names a doctor while scope is all doctors', () => {
  const review = reviewHolidayScope({ doctorScope: 'all', clinicScope: 'all', reason: '張敏言醫師休息。' });
  assert.equal(review.isNetworkWide, true);
  assert.deepEqual(review.doctorsNamedWithAllScope, ['cheungmy']);
  assert.equal(review.needsConfirmation, true);
});

test('reason naming a doctor with all doctors at one clinic still needs confirmation', () => {
  const review = reviewHolidayScope({ doctorScope: 'all', clinicScope: 'jordan', reason: '陳醫師休息' });
  assert.equal(review.isNetworkWide, false);
  assert.deepEqual(review.doctorsNamedWithAllScope, ['chan']);
  assert.equal(review.needsConfirmation, true);
});

test('specific doctor is OK without confirmation, even when the reason names them', () => {
  const review = reviewHolidayScope({ doctorScope: 'cheungmy', clinicScope: 'all', reason: '張敏言醫師休息。' });
  assert.deepEqual(review.missing, []);
  assert.equal(review.isNetworkWide, false);
  assert.deepEqual(review.doctorsNamedWithAllScope, []);
  assert.equal(review.needsConfirmation, false);
});

test('doctor name detection covers full, short and surname forms', () => {
  assert.deepEqual(findDoctorsNamedInReason('張敏言休息'), ['cheungmy']);
  assert.deepEqual(findDoctorsNamedInReason('敏言醫師請假'), ['cheungmy']);
  assert.deepEqual(findDoctorsNamedInReason('陳醫師進修'), ['chan']);
  assert.deepEqual(findDoctorsNamedInReason('黃脊醫休息'), ['wong']);
  assert.deepEqual(findDoctorsNamedInReason('dr. lee off'), ['lee']);
  // 張醫師 is ambiguous between two doctors; both are reported.
  assert.deepEqual(findDoctorsNamedInReason('張醫師休息').sort(), ['cheung', 'cheungmy']);
  assert.deepEqual(findDoctorsNamedInReason('23/4(四)員工活動日，全線休息一日'), []);
  assert.deepEqual(findDoctorsNamedInReason(''), []);
});

test('stored NULL maps back to explicit all, and network-wide rows are detected', () => {
  assert.equal(toHolidayScopeValue(null), 'all');
  assert.equal(toHolidayScopeValue('cheungmy'), 'cheungmy');
  assert.equal(isNetworkWideHoliday({ doctorId: null, clinicId: null }), true);
  assert.equal(isNetworkWideHoliday({ doctorId: 'cheungmy', clinicId: null }), false);
  assert.equal(isNetworkWideHoliday({ doctorId: null, clinicId: 'jordan' }), false);
});

test('missing audit column errors are detected for insert and select', () => {
  assert.equal(
    isMissingHolidayAuditColumnError({ message: "Could not find the 'created_by' column of 'holidays' in the schema cache" }),
    true
  );
  assert.equal(isMissingHolidayAuditColumnError({ message: 'column holidays.created_by does not exist' }), true);
  assert.equal(isMissingHolidayAuditColumnError({ message: 'duplicate key value violates unique constraint' }), false);
});
