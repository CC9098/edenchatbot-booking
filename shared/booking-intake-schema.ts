import { z } from 'zod';

import { bookingSchema } from '@/shared/types';
import { ALL_BOOKING_PICKUP_VALUES } from '@/shared/booking-pickup';

export const detailedBookingSchema = bookingSchema
  .extend({
    visitType: z.enum(['first', 'followup']),
    needReceipt: z.enum(['no', 'yes_insurance', 'yes_not_insurance']),
    medicationPickup: z.enum(ALL_BOOKING_PICKUP_VALUES),
    idCard: z.string().optional(),
    dateOfBirth: z.string().optional(),
    gender: z.enum(['male', 'female', 'other']).optional(),
    allergies: z.string().optional(),
    medications: z.string().optional(),
    symptoms: z.string().optional(),
    referralSource: z.string().optional(),
  })
  .strict();

export type DetailedBookingRequest = z.infer<typeof detailedBookingSchema>;
