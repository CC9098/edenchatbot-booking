import { CLINICS, DOCTORS } from '@/shared/clinic-data';
import type { BookingLocale } from '@/shared/booking-locale';

export function notificationDoctorName(name: string, locale?: BookingLocale): string {
  if (locale !== 'en') return name;
  const doctor = DOCTORS.find(item => item.nameZh === name || item.nameZh === `${name}醫師`);
  if (!doctor) return name;
  return DOCTORS.filter(item => item.nameEn === doctor.nameEn).length > 1
    ? `${doctor.nameEn} (${doctor.nameZh})` : doctor.nameEn;
}

export function notificationClinicName(name: string, locale?: BookingLocale): string {
  return locale === 'en' ? CLINICS.find(clinic => clinic.nameZh === name)?.nameEn || name : name;
}

type WhatsappTemplate = { name?: string | null; language?: string | null; status?: string | null; category?: string | null };

/** English notifications only use approved English templates; never silently substitute Chinese. */
export function approvedEnglishBookingTemplates(
  templates: readonly WhatsappTemplate[],
  names: readonly string[],
  configuredName?: string,
) {
  const allowedNames = new Set([...names, ...names.map(name => `${name}_en`), configuredName?.trim()].filter(Boolean));
  return templates.filter(template => template.name && allowedNames.has(template.name)
    && /^en(?:_|$)/i.test(template.language || '') && template.status?.toLowerCase() === 'approved')
    .sort((a, b) => Number(b.name === configuredName) - Number(a.name === configuredName))
    .map(template => ({ name: template.name!, language: template.language!, category: template.category || 'UTILITY' }));
}
