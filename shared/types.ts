import { z } from 'zod';
import { ALL_BOOKING_TREATMENT_OPTION_IDS } from '@/shared/booking-treatment-options';

const optionalEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .refine(
    (value) => value === '' || z.string().email().safeParse(value).success,
    { message: 'Invalid email address' }
  );

// Zod Schemas for validation
export const availabilitySchema = z.object({
                doctorId: z.string(),
                clinicId: z.string(),
                date: z.string(), // ISO date string YYYY-MM-DD
                durationMinutes: z.number().default(15),
                visitType: z.enum(['first', 'followup']).optional(),
});

export const bookingSchema = z.object({
                doctorId: z.string(),
                doctorName: z.string(),
                doctorNameZh: z.string(),
                clinicId: z.string(),
                clinicName: z.string(),
                clinicNameZh: z.string(),
                date: z.string(), // ISO date string YYYY-MM-DD
                time: z.string(), // HH:mm format
                durationMinutes: z.number().default(15),
                patientName: z.string().min(2),
                phone: z.string().min(8),
                email: optionalEmailSchema,
                treatmentOptions: z.array(z.enum(ALL_BOOKING_TREATMENT_OPTION_IDS)).optional(),
                notes: z.string().optional(),
});

// TypeScript Types derived from Zod schemas
export type AvailabilityRequest = z.infer<typeof availabilitySchema>;
export type BookingRequest = z.infer<typeof bookingSchema>;

// API Response Types
export interface AvailabilityResponse {
                success: boolean;
                slots?: string[]; // Array of "HH:mm" strings
                error?: string;
                isClosed?: boolean;
                isHoliday?: boolean;
}

export interface BookingResponse {
                success: boolean;
                bookingId?: string; // Google Calendar Event ID or DB ID
                error?: string;
}

// Option Keys for Chatbot Flow
export type ChatbotBookingState = {
                doctorId?: string;
                doctorName?: string;
                doctorNameZh?: string;
                clinicId?: string;
                clinicName?: string;
                clinicNameZh?: string;
                date?: string;
                time?: string;
                patientName?: string;
                phone?: string;
                email?: string;
                treatmentOptions?: string[];
                notes?: string;
};
