import assert from 'node:assert/strict';
import test from 'node:test';
import { detailedBookingSchema } from '@/shared/booking-intake-schema';
import { DOCTOR_BY_ID, isDoctorAcceptingBookings } from '@/shared/clinic-data';

const request = {
  doctorId: 'chan', doctorName: 'Dr. Chan', doctorNameZh: '陳家富醫師',
  clinicId: 'central', clinicName: 'Central', clinicNameZh: '中環',
  date: '2026-11-04', time: '11:00', patientName: 'Test Patient',
  phone: '00000000', email: '', visitType: 'followup', needReceipt: 'no',
  medicationPickup: 'none', locale: 'en',
};

test('booking API validation rejects departed practitioners at physical and online clinics', () => {
  for (const clinicId of ['jordan', 'tsuenwan', 'online']) {
    const result = detailedBookingSchema.safeParse({ ...request, doctorId: 'cheungmy', clinicId });
    assert.equal(result.success, false, `${clinicId}: retired practitioner cannot create a booking`);
    if (!result.success) {
      assert.deepEqual(result.error.issues.map(issue => issue.path), [['doctorId']]);
    }
  }
  assert.equal(DOCTOR_BY_ID.cheungmy.nameZh, '張敏言醫師', 'historical practitioner identity remains');
});

test('current practitioner bookings remain valid including physical chiropractic appointments', () => {
  assert.equal(detailedBookingSchema.safeParse(request).success, true);
  assert.equal(detailedBookingSchema.safeParse({ ...request, doctorId: 'wong', clinicId: 'jordan' }).success, true);
  assert.equal(isDoctorAcceptingBookings('wong'), true);
  assert.equal(DOCTOR_BY_ID.wong.onlineBookingEnabled, false, 'video appointment flag remains independent');
});
