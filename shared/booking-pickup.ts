export const BASE_BOOKING_PICKUP_VALUES = [
  'none',
  'lalamove',
  'sfexpress',
  'clinic_pickup',
] as const;

export const ONLINE_BOOKING_EXTRA_PICKUP_VALUES = [
  'overseas_shipping',
  'central_pickup',
  'jordan_pickup',
  'tsuenwan_pickup',
] as const;

export const ALL_BOOKING_PICKUP_VALUES = [
  ...BASE_BOOKING_PICKUP_VALUES,
  ...ONLINE_BOOKING_EXTRA_PICKUP_VALUES,
] as const;

export const BOOKING_SHIPPING_PICKUP_VALUES = [
  'lalamove',
  'sfexpress',
  'overseas_shipping',
] as const satisfies readonly BookingPickupType[];

export const BOOKING_CLINIC_PICKUP_VALUES = [
  'clinic_pickup',
  'central_pickup',
  'jordan_pickup',
  'tsuenwan_pickup',
] as const satisfies readonly BookingPickupType[];

export type BookingPickupType = (typeof ALL_BOOKING_PICKUP_VALUES)[number];

export const BOOKING_PICKUP_LABELS: Record<BookingPickupType, string> = {
  none: '不需要',
  lalamove: '即日配送（Lalamove）',
  sfexpress: '順豐速運',
  clinic_pickup: '診所自取',
  overseas_shipping: '海外郵寄',
  central_pickup: '中環診所自取',
  jordan_pickup: '佐敦診所自取',
  tsuenwan_pickup: '荃灣診所自取',
};

export function getBookingPickupOptions(clinicId?: string | null) {
  const values =
    clinicId === 'online'
      ? ALL_BOOKING_PICKUP_VALUES
      : BASE_BOOKING_PICKUP_VALUES;

  return values.map((value) => ({
    value,
    label: BOOKING_PICKUP_LABELS[value],
  }));
}

export function isShippingBookingPickup(value?: string | null): value is BookingPickupType {
  return typeof value === 'string' && BOOKING_SHIPPING_PICKUP_VALUES.some((option) => option === value);
}

export function isClinicPickupBookingPickup(value?: string | null): value is BookingPickupType {
  return typeof value === 'string' && BOOKING_CLINIC_PICKUP_VALUES.some((option) => option === value);
}
