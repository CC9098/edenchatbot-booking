import type { BookableDoctorSchedule } from '@/shared/bookable-schedule-data';
import type { HolidayNotice } from '@/lib/holiday-notices';

// Shape read by the edenclinic.hk homepage booking box (website/homepage-aeo-2026-10-13).
export type HomepageScheduleData = {
  fetchedAt: string;
  doctors: {
    id: string;
    name: string;
    group: string;
    treatments: string[];
    clinics: { id: string; schedule: BookableDoctorSchedule['clinics'][number]['schedule'] }[];
  }[];
  notices: {
    doctor: string | null;
    clinic: string | null;
    start: string;
    end: string;
    allDay: boolean;
    text: string;
  }[];
};

export function toHomepageSchedule(
  doctors: BookableDoctorSchedule[],
  notices: HolidayNotice[],
  now: Date = new Date()
): HomepageScheduleData {
  return {
    fetchedAt: now.toISOString(),
    doctors: doctors.map((d) => ({
      id: d.doctorId,
      name: d.doctorNameZh,
      group: d.bookingPractitionerGroup,
      treatments: d.bookingTreatmentOptions.map((t) => t.id),
      clinics: d.clinics
        .filter((c) => Object.values(c.schedule).some((ranges) => Array.isArray(ranges) && ranges.length > 0))
        .map((c) => ({ id: c.clinicId, schedule: c.schedule })),
    })),
    notices: notices.map((n) => ({
      doctor: n.doctorId ?? null,
      clinic: n.clinicId ?? null,
      start: n.startDate,
      end: n.endDate,
      allDay: !n.timeLabel,
      text: n.bookingText,
    })),
  };
}
