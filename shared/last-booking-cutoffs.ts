import { DOCTOR_IDS, type DoctorId, type PhysicalClinicId } from './clinic-data';

export const LAST_BOOKING_CUTOFFS = {
  doctorIds: DOCTOR_IDS,
  morningSessionEnd: '14:00',
  lunch: '13:15',
  evening: { central: '18:45', jordan: '18:45', tsuenwan: '18:15' },
  leeSaturdayJordan: '17:45',
} as const satisfies {
  doctorIds: readonly DoctorId[];
  morningSessionEnd: string;
  lunch: string;
  evening: Record<PhysicalClinicId, string>;
  leeSaturdayJordan: string;
};
