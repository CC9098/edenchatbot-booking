export type Sender = 'bot' | 'user';

export type Message = {
  id: string;
  sender: Sender;
  text: string;
  links?: { label: string; href: string }[];
};

export type OptionKey =
  | 'fees'
  | 'clinic'
  | 'hours'
  | 'addresses'
  | 'booking'
  | 'timetable'
  | 'other'
  | 'consult'
  | 'end'
  | 'main'
  | `doctor-${string}`
  | `booking_clinic-${string}`
  | `booking_date-${string}`
  | `booking_time-${string}`
  | 'booking_visit_first'
  | 'booking_visit_followup'
  | `booking_receipt-${string}`
  | `booking_pickup-${string}`
  | `booking_gender-${string}`
  | `booking_referral-${string}`
  | 'booking_confirm'
  | 'booking_cancel'
  | 'booking_back';

export type Option = { label: string; value: OptionKey };

export type FormStepKey = 'reason' | 'name' | 'email' | 'phone';
export type ConsultationFormData = Record<FormStepKey, string>;

export type BookingStep =
  | 'doctor' | 'clinic' | 'visitType' | 'date' | 'time'
  | 'lastName' | 'firstName' | 'phone' | 'email'
  | 'receipt' | 'medicationPickup'
  | 'idCard' | 'dob' | 'gender' | 'allergies' | 'medications' | 'symptoms' | 'referralSource'
  | 'confirm';

export type BookingState = {
  step: BookingStep;
  doctorId?: string;
  doctorNameZh?: string;
  doctorName?: string;
  clinicId?: string;
  clinicNameZh?: string;
  clinicName?: string;
  isFirstVisit?: boolean;
  date?: string;
  time?: string;
  lastName?: string;
  firstName?: string;
  phone?: string;
  email?: string;
  needReceipt?: string;
  medicationPickup?: string;
  idCard?: string;
  dob?: string;
  gender?: string;
  allergies?: string;
  medications?: string;
  symptoms?: string;
  referralSource?: string;
};
