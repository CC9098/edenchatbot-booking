import type { BookingLocale } from '@/shared/booking-locale';
import { DOCTOR_BY_ID } from '@/shared/clinic-data';
import { LAST_BOOKING_CUTOFFS } from '@/shared/last-booking-cutoffs';

export function BookingCutoffNotice({ locale = 'zh' }: { locale?: BookingLocale }) {
  const en = locale === 'en';
  const { doctorIds, lunch, evening, leeSaturdayJordan } = LAST_BOOKING_CUTOFFS;
  const doctors = doctorIds.map((id) => en ? DOCTOR_BY_ID[id].nameEn : DOCTOR_BY_ID[id].nameZh);
  const title = en ? 'Last appointment start times' : '最後可預約時間';
  const times = [
    [en ? 'Before lunch' : '午飯前', lunch],
    [en ? 'Central / Jordan evening' : '中環／佐敦晚間', evening.central],
    [en ? 'Tsuen Wan evening' : '荃灣晚間', evening.tsuenwan],
  ];

  return (
    <section aria-label={title} className="rounded-xl border border-primary/15 bg-primary-pale px-3 py-2.5 text-sm leading-relaxed text-slate-700 sm:px-4">
      <p className="font-semibold text-primary">{title} · {doctors.join(en ? ' and ' : '、')}</p>
      <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5">
        {times.map(([label, time]) => (
          <li key={label}>{label} <strong className="tabular-nums">{time}</strong></li>
        ))}
      </ul>
      <p className="mt-1">
        {en ? 'Dr. Lee in Jordan on Saturdays: ' : '李芊霖醫師星期六佐敦：'}
        <strong className="tabular-nums">{leeSaturdayJordan}</strong>
        {en ? '. Online visits follow the same cutoff as the clinic for that session.' : '。網上診症按該節應診分店的最後預約時間。'}
      </p>
    </section>
  );
}
