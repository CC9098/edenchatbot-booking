export const ALL_BOOKING_TREATMENT_OPTION_IDS = [
  'acupuncture',
  'manual_therapy',
] as const;

export type BookingTreatmentOptionId =
  (typeof ALL_BOOKING_TREATMENT_OPTION_IDS)[number];

export type BookingTreatmentOption = {
  id: BookingTreatmentOptionId;
  labelZh: string;
  labelEn: string;
};

export const BOOKING_TREATMENT_OPTIONS: readonly BookingTreatmentOption[] = [
  {
    id: 'acupuncture',
    labelZh: '針灸',
    labelEn: 'Acupuncture',
  },
  {
    id: 'manual_therapy',
    labelZh: '治療手法',
    labelEn: 'Manual therapy',
  },
];

const BOOKING_TREATMENT_OPTION_BY_ID: Record<
  BookingTreatmentOptionId,
  BookingTreatmentOption
> = Object.fromEntries(
  BOOKING_TREATMENT_OPTIONS.map((option) => [option.id, option])
) as Record<BookingTreatmentOptionId, BookingTreatmentOption>;

export function getBookingTreatmentOptionsByIds(
  ids: readonly BookingTreatmentOptionId[]
): BookingTreatmentOption[] {
  return ids
    .map((id) => BOOKING_TREATMENT_OPTION_BY_ID[id])
    .filter(Boolean);
}

export function formatBookingTreatmentOptionLabel(
  option: Pick<BookingTreatmentOption, 'labelZh' | 'labelEn'>
): string {
  return `${option.labelZh} ${option.labelEn}`;
}

export function formatBookingTreatmentLabelFromIds(
  ids: readonly BookingTreatmentOptionId[]
): string {
  const options = getBookingTreatmentOptionsByIds(ids);
  if (options.length === 0) return '';

  const zh = options.map((option) => option.labelZh).join('/');
  const en = options.map((option) => option.labelEn).join(' / ');
  return `${zh} ${en}`;
}
