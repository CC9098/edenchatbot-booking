import type { BookingVisitType } from "@/lib/public-url";
import { isClinicId, isDoctorId, type ClinicId, type DoctorId } from "@/shared/clinic-data";

export type BookingInitialSelection = {
  doctorId?: DoctorId;
  clinicId?: ClinicId;
  visitType?: BookingVisitType;
  gad7Score?: number;
  source?: string;
  date?: string;
};

function getFirstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

export function parseBookingDate(value: string | undefined): string | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
    ? value
    : undefined;
}

export function parseBookingInitialSelection(
  searchParams?: Record<string, string | string[] | undefined>
): BookingInitialSelection {
  const doctorParam = getFirstParam(searchParams?.doctor);
  const clinicParam = getFirstParam(searchParams?.clinic);
  const visitTypeParam = getFirstParam(searchParams?.visitType);
  const gad7Param = getFirstParam(searchParams?.gad7);
  const sourceParam = getFirstParam(searchParams?.source) || getFirstParam(searchParams?.src);
  const gad7Score =
    gad7Param && /^\d{1,2}$/.test(gad7Param)
      ? Number(gad7Param)
      : undefined;
  const source = sourceParam?.trim().slice(0, 80);

  return {
    doctorId: doctorParam && isDoctorId(doctorParam) ? doctorParam : undefined,
    clinicId: clinicParam && isClinicId(clinicParam) ? clinicParam : undefined,
    visitType:
      visitTypeParam === "first" || visitTypeParam === "followup"
        ? visitTypeParam
        : undefined,
    gad7Score:
      typeof gad7Score === "number" && gad7Score >= 0 && gad7Score <= 21
        ? gad7Score
        : undefined,
    source: source || undefined,
    date: parseBookingDate(getFirstParam(searchParams?.date)),
  };
}
