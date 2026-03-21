import type { BookingVisitType } from "@/lib/public-url";
import { isClinicId, isDoctorId, type ClinicId, type DoctorId } from "@/shared/clinic-data";

export type BookingInitialSelection = {
  doctorId?: DoctorId;
  clinicId?: ClinicId;
  visitType?: BookingVisitType;
};

function getFirstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

export function parseBookingInitialSelection(
  searchParams?: Record<string, string | string[] | undefined>
): BookingInitialSelection {
  const doctorParam = getFirstParam(searchParams?.doctor);
  const clinicParam = getFirstParam(searchParams?.clinic);
  const visitTypeParam = getFirstParam(searchParams?.visitType);

  return {
    doctorId: doctorParam && isDoctorId(doctorParam) ? doctorParam : undefined,
    clinicId: clinicParam && isClinicId(clinicParam) ? clinicParam : undefined,
    visitType:
      visitTypeParam === "first" || visitTypeParam === "followup"
        ? visitTypeParam
        : undefined,
  };
}
