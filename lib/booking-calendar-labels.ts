import type { BookingVisitType } from '@/lib/booking-intake-storage';

export function readBookingCalendarVisitType(
  value: unknown,
  description: string,
  summary: string,
): BookingVisitType {
  if (value === 'first' || value === 'followup') return value;

  const visitLabel = description.match(/^Visit Type \/ 類型:[ \t]*(.*)$/im)?.[1]
    || description.match(/(?:^|\n|\|[ \t]*)\[(首診|新症|First visit|覆診|Follow-up)\]/i)?.[1];
  if (visitLabel) return /首診|新症|\bfirst\b/i.test(visitLabel) ? 'first' : 'followup';

  return / - (?:【天灸】)?【新症】/.test(summary) ? 'first' : 'followup';
}

export function readBookingCalendarPatientName(summary: string): string {
  return summary.split(' - ').slice(1).join(' - ')
    .replace(/^(?:【新症】|【天灸】)+\s*/, '').trim();
}

export function buildBookingEventSummary(details: {
  doctorNameZh: string;
  clinicNameZh: string;
  patientName: string;
  visitType?: BookingVisitType;
  isTianJiu?: boolean;
}): string {
  const visitLabel = details.visitType === 'first' ? '【新症】' : '';
  const treatmentLabel = details.isTianJiu ? '【天灸】' : '';
  return `${details.doctorNameZh}｜${details.clinicNameZh} - ${visitLabel}${treatmentLabel}${details.patientName}`;
}

export function hasTianJiuBookingLabel(notes = ''): boolean {
  return /(?:^|\n|\|[ \t]*)(?:服務|治療項目|Service|Treatments?)[ \t]*[:：][^|\r\n]*?(?:天[灸炙]|\btian[ -]?jiu\b)/i.test(notes)
    || /^(?:天[灸炙]|tian[ -]?jiu)$/i.test(notes.trim());
}
