import snapshot from './site.json';
import { CLINIC_BY_ID, DOCTOR_BY_ID, type ClinicId, type DoctorId } from '@/shared/clinic-data';

export const englishArticles = snapshot.articles;
export type EnglishArticle = typeof englishArticles[number];
export const englishServices = snapshot.services;
export const englishRoutes = snapshot.routes;
export const englishPages = snapshot.pages;
export const englishDoctors = snapshot.doctors.map(edition => ({
  ...edition,
  // Stable IDs, Chinese names and online booking availability belong to the shared application.
  zh: DOCTOR_BY_ID[edition.id as DoctorId].nameZh,
  booking: DOCTOR_BY_ID[edition.id as DoctorId].onlineBookingEnabled !== false && edition.booking,
}));
export const englishClinics = snapshot.clinics.map(translation => {
  const current = CLINIC_BY_ID[translation.id as ClinicId];
  return {
    ...translation,
    name: current.nameEn,
    // Fall back to current facts if the English translation has not caught up with a clinic change.
    address: current.address === translation.sourceAddress ? translation.address : current.address,
    hours: current.hoursText === translation.sourceHours ? translation.hours : [current.hoursText],
    phone: current.phones[0],
    whatsappUrl: current.whatsappUrl,
    map: current.googleMapUrl,
  };
});

export function englishPath(path: string) {
  return `/en${path === '/' ? '' : path.replace(/\/$/, '')}`;
}
export function englishBookingUrl(doctor?: string, clinic?: string) {
  const params = new URLSearchParams({ lang: 'en', source: 'eden-english-site' });
  if (doctor && englishDoctors.some(practitioner => practitioner.id === doctor && practitioner.booking)) {
    params.set('doctor', doctor);
  }
  if (clinic) params.set('clinic', clinic);
  return `/en/booking?${params}`;
}
export function articleReadMinutes(article: EnglishArticle) {
  return Math.max(2, Math.ceil(article.body.split(/\s+/).length / 200));
}
export function articleHeadingId(heading: string) {
  return heading.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
export function relatedArticles(article: EnglishArticle) {
  const words = new Set(article.title.toLowerCase().match(/[a-z]{4,}/g)?.filter(word => !['with', 'your', 'what', 'chinese', 'medicine', 'care', 'understanding', 'treatment'].includes(word)));
  return englishArticles.filter(candidate => candidate.category === article.category && candidate.id !== article.id)
    .map((candidate, index) => ({ candidate, index, score: (candidate.title.toLowerCase().match(/[a-z]{4,}/g) || []).filter(word => words.has(word)).length }))
    .sort((a, b) => b.score - a.score || a.index - b.index).slice(0, 3).map(({ candidate }) => candidate);
}
