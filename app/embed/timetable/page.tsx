import { CalendarClock, CalendarDays, Clock3, ExternalLink } from 'lucide-react';
import Image from "next/image";

import { EmbedAutoHeightReporter } from '@/components/embed/EmbedAutoHeightReporter';
import { buildBookingUrl } from '@/lib/public-url';
import { getPublicTimetableData, type TimetableClinicCard } from '@/lib/public-timetable-data-server';
import { DOCTORS, PHYSICAL_CLINIC_IDS, type DoctorId, type PhysicalClinicId } from '@/shared/clinic-data';

export const dynamic = 'force-dynamic';

const DAY_COLUMNS = [
  { day: 1, label: '星期一', short: 'MON' },
  { day: 2, label: '星期二', short: 'TUE' },
  { day: 3, label: '星期三', short: 'WED' },
  { day: 4, label: '星期四', short: 'THU' },
  { day: 5, label: '星期五', short: 'FRI' },
  { day: 6, label: '星期六', short: 'SAT' },
  { day: 0, label: '星期日', short: 'SUN' },
] as const;

const CHIROPRACTIC_DOCTOR_IDS = ['wong'] as const satisfies readonly DoctorId[];
const CHIROPRACTIC_LABEL = '脊醫';

const CLINIC_THEMES: Record<
  PhysicalClinicId,
  {
    accent: string;
    dayPill: string;
    panelBg: string;
    ribbon: string;
    ribbonTag: string;
    ribbonShadow: string;
    sessionBg: string;
    emptyCellBg: string;
  }
> = {
  central: {
    accent: '#a76c2f',
    dayPill: '#f59a11',
    panelBg: '#f4dfb8',
    ribbon: '#f5a232',
    ribbonTag: '#f7b23d',
    ribbonShadow: 'rgba(70, 34, 4, 0.44)',
    sessionBg: '#9f6f3a',
    emptyCellBg: '#edb34f',
  },
  jordan: {
    accent: '#138d8d',
    dayPill: '#94bf2b',
    panelBg: '#d6e4c6',
    ribbon: '#2f8c10',
    ribbonTag: '#cadb35',
    ribbonShadow: 'rgba(18, 48, 6, 0.38)',
    sessionBg: '#12a9a4',
    emptyCellBg: '#a4cd76',
  },
  tsuenwan: {
    accent: '#1ea7b4',
    dayPill: '#17a8b0',
    panelBg: '#c5e3e2',
    ribbon: '#32b6c7',
    ribbonTag: '#58d1de',
    ribbonShadow: 'rgba(8, 62, 69, 0.34)',
    sessionBg: '#8a62ad',
    emptyCellBg: '#86c8c6',
  },
};

const CHIROPRACTIC_DOCTOR_ID_SET = new Set<string>(CHIROPRACTIC_DOCTOR_IDS);

function getDoctorAvatarFallback(nameZh?: string): string {
  return nameZh?.trim().slice(0, 1) || '醫';
}

function isChiropracticDoctor(doctorId: DoctorId): boolean {
  return CHIROPRACTIC_DOCTOR_ID_SET.has(doctorId);
}

function getDoctorStripOrder() {
  const chiropracticDoctors = DOCTORS.filter((doctor) => isChiropracticDoctor(doctor.id));
  const regularDoctors = DOCTORS.filter((doctor) => !isChiropracticDoctor(doctor.id));
  return [...chiropracticDoctors, ...regularDoctors];
}

function DoctorStripCard({
  doctor,
  isFeatured,
}: {
  doctor: (typeof DOCTORS)[number];
  isFeatured: boolean;
}) {
  return (
    <a
      href={doctor.bookingUrl || buildBookingUrl({ doctorId: doctor.id })}
      target="_top"
      rel="noreferrer"
      className={`group relative flex min-w-[104px] flex-col items-center gap-1 rounded-[16px] border px-3 py-2 transition ${
        isFeatured
          ? 'border-emerald-300/80 bg-emerald-50 text-emerald-700'
          : 'border-slate-200/80 bg-white/85 text-slate-700'
      } hover:-translate-y-0.5 hover:shadow-[0_14px_30px_-24px_rgba(15,23,42,0.6)]`}
    >
      <div className="relative h-14 w-14 overflow-hidden rounded-full border-4 border-white bg-[#edf7ef] shadow-[0_12px_28px_-20px_rgba(31,74,44,0.45)]">
        {doctor.avatarSrc ? (
          <Image
            src={doctor.avatarSrc}
            alt={`${doctor.nameZh}頭像`}
            fill
            sizes="56px"
            className="object-cover"
            style={{ objectPosition: doctor.avatarObjectPosition || 'center' }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top,#eaf8ed_0%,#cfe8d6_100%)] text-lg font-semibold text-[#2b5d38]">
            {getDoctorAvatarFallback(doctor.nameZh)}
          </div>
        )}
      </div>

      <div className="text-center">
        <p className="text-[11px] leading-tight font-semibold tracking-[0.02em]">{doctor.nameZh}</p>
      </div>

      {isFeatured ? (
        <span className="inline-flex items-center rounded-full border border-emerald-300/80 bg-white px-2 py-0.5 text-[10px] font-bold tracking-[0.18em]">
          {CHIROPRACTIC_LABEL}
        </span>
      ) : null}
    </a>
  );
}

function DoctorStrip() {
  const doctorList = getDoctorStripOrder();
  if (doctorList.length === 0) return null;

  return (
    <section className="mb-5">
      <p className="text-sm font-semibold tracking-[0.04em] text-slate-700">
        醫師名片
      </p>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {doctorList.map((doctor) => (
          <DoctorStripCard
            key={doctor.id}
            doctor={doctor}
            isFeatured={isChiropracticDoctor(doctor.id)}
          />
        ))}
      </div>
    </section>
  );
}

const DOCTOR_TONES: Record<
  string,
  {
    text: string;
  }
> = {
  chan: { text: '#6f31b5' },
  lee: { text: '#8d6a1d' },
  hon: { text: '#238f3d' },
  chau: { text: '#228a8c' },
  cheung: { text: '#dd6d86' },
  leung: { text: '#238f3d' },
};

const MONTH_LABELS_ZH = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
const MONTH_VALUE_REGEX = /^\d{4}-\d{2}$/;

function getTodayMonthStart(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Hong_Kong',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function toMonthStart(dateIso: string): string {
  const date = new Date(`${dateIso}T00:00:00+08:00`);
  if (Number.isNaN(date.getTime())) return `${getTodayMonthStart().slice(0, 7)}-01`;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
}

function toNextMonthStart(monthStartIso: string): string {
  const [yearText, monthText] = monthStartIso.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return monthStartIso;
  }

  const next = new Date(Date.UTC(year, month, 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

function normalizeMonthQuery(raw: string | undefined, fallback: string): string {
  if (!raw) return fallback;
  const trimmed = raw.trim();
  if (!MONTH_VALUE_REGEX.test(trimmed)) return fallback;

  const [yearText, monthText] = trimmed.split('-');
  const month = Number(monthText);
  const year = Number(yearText);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return fallback;
  }

  return `${yearText}-${monthText}-01`;
}

function monthLabel(monthStartIso: string): string {
  const month = Number(monthStartIso.split('-')[1]);
  return `${MONTH_LABELS_ZH[month - 1] || '未指定'}（${monthStartIso.slice(0, 4)}）`;
}

function buildMonthHref(month: string, minimal: boolean, clinicId: string | undefined): string {
  const params = new URLSearchParams();
  params.set('month', month);
  if (minimal) {
    params.set('minimal', '1');
  }
  if (clinicId) {
    params.set('clinic', clinicId);
  }
  return `/embed/timetable?${params.toString()}`;
}

function buildQueryValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function normalizeClinicFilter(value: string | undefined): PhysicalClinicId | undefined {
  if (!value) return undefined;
  return PHYSICAL_CLINIC_IDS.includes(value as PhysicalClinicId)
    ? (value as PhysicalClinicId)
    : undefined;
}

function isMinimalMode(value: string | undefined): boolean {
  return value === '1' || value === 'true' || value === 'yes';
}

function splitDoctorName(name: string) {
  return {
    surname: name.slice(0, 1),
    given: name.slice(1),
  };
}

function getDoctorTone(doctorId: string): string {
  return DOCTOR_TONES[doctorId]?.text ?? '#334155';
}

function buildMonthRibbonLabel() {
  const formatter = new Intl.DateTimeFormat('zh-HK', {
    timeZone: 'Asia/Hong_Kong',
    year: 'numeric',
    month: 'numeric',
  });
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const currentParts = formatter.formatToParts(now);
  const nextParts = formatter.formatToParts(nextMonth);
  const year = currentParts.find((part) => part.type === 'year')?.value ?? `${now.getFullYear()}`;
  const currentMonth = currentParts.find((part) => part.type === 'month')?.value ?? `${now.getMonth() + 1}`;
  const nextMonthValue = nextParts.find((part) => part.type === 'month')?.value ?? `${nextMonth.getMonth() + 1}`;
  return `${year}年${currentMonth}-${nextMonthValue}月`;
}

function getPrimaryTimeLabel(card: TimetableClinicCard, rowId: 'morning' | 'afternoon') {
  const row = card.rows.find((item) => item.id === rowId);
  if (!row) return '';

  const counter = new Map<string, number>();
  for (const column of DAY_COLUMNS) {
    for (const entry of row.cells[column.day]) {
      counter.set(entry.timeLabel, (counter.get(entry.timeLabel) ?? 0) + 1);
    }
  }

  return Array.from(counter.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? '';
}

function rowHasTimeException(card: TimetableClinicCard, rowId: 'morning' | 'afternoon') {
  const row = card.rows.find((item) => item.id === rowId);
  if (!row) return false;

  const primary = getPrimaryTimeLabel(card, rowId);
  if (!primary) return false;

  return DAY_COLUMNS.some((column) =>
    row.cells[column.day].some((entry) => entry.timeLabel !== primary)
  );
}

function ClinicCard({ card }: { card: TimetableClinicCard }) {
  const theme = CLINIC_THEMES[card.clinicId];
  const versionLabel = buildMonthRibbonLabel();
  const morningLabel = getPrimaryTimeLabel(card, 'morning');
  const afternoonLabel = getPrimaryTimeLabel(card, 'afternoon');
  const hasException = rowHasTimeException(card, 'morning') || rowHasTimeException(card, 'afternoon');

  return (
    <section className="overflow-hidden rounded-[30px] px-1 py-2">
      <div className="mb-5 flex items-center pl-2 sm:pl-6">
        <div
          className="relative z-0 shrink-0 px-5 py-2 text-lg font-bold tracking-[0.04em] text-white shadow-[0_10px_0_rgba(0,0,0,0.22),0_20px_26px_-20px_rgba(0,0,0,0.68)]"
          style={{ background: theme.ribbon }}
        >
          {versionLabel}
        </div>

        <div
          className="relative z-10 -ml-3 shrink-0 -skew-x-12 px-7 py-3 text-white shadow-[0_12px_0_rgba(0,0,0,0.2),0_22px_26px_-20px_rgba(0,0,0,0.68)]"
          style={{ background: theme.ribbonTag }}
        >
          <span className="block skew-x-12 text-4xl font-black tracking-[0.08em]">
            {card.clinicNameZh}
          </span>
        </div>

        <div className="-ml-3 hidden min-w-0 flex-1 items-stretch sm:flex">
          <div
            className="-skew-x-12 px-8 py-3 text-white shadow-[0_10px_0_rgba(0,0,0,0.2),0_20px_26px_-20px_rgba(0,0,0,0.68)]"
            style={{ background: theme.ribbon }}
          >
            <span className="block skew-x-12 text-[clamp(1.15rem,2vw,2.2rem)] font-bold tracking-[0.06em]">
              {card.clinicNameZh}中醫診所應診時間表
            </span>
          </div>
          <div
            className="-ml-2 h-auto w-8 -skew-x-12 shadow-[0_10px_0_rgba(0,0,0,0.2)]"
            style={{ background: theme.ribbon }}
          />
        </div>
      </div>

      {/* Mobile: compact 7-day grid — surname only + icon */}
      <div className="md:hidden">
        <div className="grid grid-cols-[44px_repeat(7,minmax(0,1fr))] gap-1">
          <div />
          {DAY_COLUMNS.map((col) => (
            <div
              key={`mc-${card.clinicId}-${col.day}-hd`}
              className="rounded-full py-1 text-center text-[11px] font-bold text-white"
              style={{ background: theme.dayPill }}
            >
              {col.label.slice(2)}
            </div>
          ))}

          {card.rows.map((row) => {
            const rowTimeLabel = row.id === 'morning' ? morningLabel : afternoonLabel;
            const [startTime, endTime] = (rowTimeLabel || '').split('-');
            return (
              <div key={`mc-${card.clinicId}-${row.id}`} className="contents">
                <div
                  className="flex flex-col items-center justify-center rounded-[10px] p-1 text-center text-white"
                  style={{ background: theme.sessionBg }}
                >
                  <span className="text-[11px] font-bold leading-none">{row.label}</span>
                  {startTime ? (
                    <span className="mt-0.5 text-[8px] leading-none opacity-90">{startTime}</span>
                  ) : null}
                  {endTime ? (
                    <span className="text-[8px] leading-none opacity-90">-{endTime}</span>
                  ) : null}
                </div>

                {DAY_COLUMNS.map((col) => {
                  const entries = row.cells[col.day];
                  return (
                    <div
                      key={`mc-${card.clinicId}-${row.id}-${col.day}`}
                      className="flex flex-col divide-y divide-white/20 overflow-hidden rounded-[10px]"
                      style={{ background: entries.length > 0 ? theme.panelBg : theme.emptyCellBg }}
                    >
                      {entries.map((entry) => {
                        const tone = getDoctorTone(entry.doctorId);
                        return (
                          <a
                            key={`mc-${card.clinicId}-${row.id}-${col.day}-${entry.doctorId}`}
                            href={entry.bookingUrl || buildBookingUrl({ doctorId: entry.doctorId, clinicId: card.clinicId })}
                            target="_top"
                            rel="noreferrer"
                            aria-label={`${entry.shortNameZh}${card.clinicNameZh}預約`}
                            title={`${entry.shortNameZh}${card.clinicNameZh}預約`}
                            className="flex flex-1 flex-col items-center justify-center py-2 transition hover:bg-white/50"
                            style={{ minHeight: '52px' }}
                          >
                            <span className="text-xl font-black leading-none" style={{ color: tone }}>
                              {entry.shortNameZh.charAt(0)}
                            </span>
                            <ExternalLink className="mt-1 h-2.5 w-2.5" style={{ color: tone }} />
                          </a>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Desktop layout — horizontal grid */}
      <div className="hidden md:block overflow-x-auto">
        <div className="min-w-[720px] lg:min-w-[980px]">
          <div className="grid grid-cols-[100px_repeat(7,minmax(0,1fr))] gap-1.5 lg:grid-cols-[150px_repeat(7,minmax(0,1fr))] lg:gap-2">
            <div />

            {DAY_COLUMNS.map((column) => (
              <div
                key={`${card.clinicId}-${column.day}-day`}
                className="rounded-full px-1 py-2 text-center text-sm font-bold tracking-[0.04em] text-white sm:px-3 sm:text-xl sm:tracking-[0.06em]"
                style={{ background: theme.dayPill }}
              >
                <span className="sm:hidden">{column.short}</span>
                <span className="hidden sm:inline">{column.label}</span>
              </div>
            ))}

            {card.rows.map((row) => {
              const rowTimeLabel = row.id === 'morning' ? morningLabel : afternoonLabel;

              return (
                <div
                  key={`${card.clinicId}-${row.id}-group`}
                  className="contents"
                >
                  <div
                    className="flex min-h-[120px] flex-col items-center justify-center rounded-[16px] px-2 py-3 text-center text-white sm:min-h-[162px] sm:rounded-[22px] sm:px-3 sm:py-4"
                    style={{ background: theme.sessionBg }}
                  >
                    <p className="text-2xl font-bold tracking-[0.08em] sm:text-4xl sm:tracking-[0.12em]">{row.label}</p>
                    <p className="mt-1 text-sm font-semibold tracking-[0.02em] sm:mt-3 sm:text-2xl sm:tracking-[0.04em]">
                      {rowTimeLabel || '最新時間'}
                    </p>
                  </div>

                  {DAY_COLUMNS.map((column) => {
                    const entries = row.cells[column.day];

                    return (
                      <div
                        key={`${card.clinicId}-${row.id}-${column.day}`}
                        className="flex min-h-[120px] items-center justify-center rounded-[16px] p-1.5 sm:min-h-[162px] sm:rounded-[22px] sm:p-3"
                        style={{ background: entries.length > 0 ? theme.panelBg : theme.emptyCellBg }}
                      >
                        {entries.length === 0 ? null : (
                          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-2 sm:gap-x-4 sm:gap-y-3">
                            {entries.map((entry) => {
                              const doctorName = splitDoctorName(entry.shortNameZh);
                              const isException = rowTimeLabel && entry.timeLabel !== rowTimeLabel;
                              const doctorTone = getDoctorTone(entry.doctorId);
                              const doctorLabel = `${entry.shortNameZh}${card.clinicNameZh}預約`;

                              return (
                                <a
                                  key={`${card.clinicId}-${row.id}-${column.day}-${entry.doctorId}-${entry.timeLabel}`}
                                  href={entry.bookingUrl || buildBookingUrl({ doctorId: entry.doctorId, clinicId: card.clinicId })}
                                  target="_top"
                                  rel="noreferrer"
                                  aria-label={doctorLabel}
                                  title={doctorLabel}
                                  className="group flex min-h-[80px] min-w-[56px] cursor-pointer flex-col items-center justify-center rounded-[14px] px-1.5 py-2 text-center transition duration-200 hover:-translate-y-0.5 hover:bg-white/65 hover:shadow-[0_14px_30px_-24px_rgba(15,23,42,0.6)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 sm:min-h-[112px] sm:min-w-[86px] sm:rounded-[20px] sm:px-3 sm:py-3"
                                >
                                  <div
                                    className="text-3xl font-black leading-none sm:text-5xl"
                                    style={{ color: doctorTone }}
                                  >
                                    {doctorName.surname}
                                  </div>
                                  <div
                                    className="mt-0.5 text-xl font-bold leading-none tracking-[0.02em] sm:mt-1 sm:text-[2rem] sm:tracking-[0.04em]"
                                    style={{ color: doctorTone }}
                                  >
                                    {doctorName.given}
                                    {isException ? '*' : ''}
                                  </div>
                                  <span
                                    className="mt-1.5 inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] transition group-hover:bg-white sm:mt-2 sm:px-2 sm:py-1 sm:text-[10px] sm:tracking-[0.16em]"
                                    style={{ borderColor: `${doctorTone}33`, color: doctorTone }}
                                  >
                                    預約
                                    <ExternalLink className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                                  </span>
                                  {isException ? (
                                    <div className="mt-1 text-[9px] font-semibold tracking-[0.06em] text-slate-500 sm:mt-2 sm:text-[11px] sm:tracking-[0.08em]">
                                      {entry.timeLabel}
                                    </div>
                                  ) : null}
                                </a>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-end gap-x-5 gap-y-2 px-1 text-sm font-semibold tracking-[0.04em] text-slate-600">
        <span>點醫師名可直接進入預約。</span>
        {hasException ? <span>* 個別時段略有不同，請以右下細字為準。</span> : null}
        <span>#公眾假期照休息</span>
      </div>
    </section>
  );
}

export default async function TimetableEmbedPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const clinicFilter = normalizeClinicFilter(buildQueryValue(searchParams?.clinic));
  const minimal = isMinimalMode(buildQueryValue(searchParams?.minimal));
  const currentMonth = toMonthStart(getTodayMonthStart());
  const selectedMonth = normalizeMonthQuery(
    buildQueryValue(searchParams?.month),
    currentMonth,
  );
  const nextMonth = toNextMonthStart(currentMonth);
  const currentMonthQueryValue = currentMonth.slice(0, 7);
  const nextMonthQueryValue = nextMonth.slice(0, 7);

  const monthOptions = [
    {
      value: currentMonthQueryValue,
      label: monthLabel(currentMonth),
      isActive: selectedMonth === currentMonth,
    },
    {
      value: nextMonthQueryValue,
      label: monthLabel(nextMonth),
      isActive: selectedMonth === nextMonth,
    },
  ];

  const { cards, generatedAtLabel, notices } = await getPublicTimetableData(selectedMonth);
  const visibleCards = clinicFilter ? cards.filter((card) => card.clinicId === clinicFilter) : cards;
  const activeMonthLabel = monthLabel(selectedMonth);

  return (
    <main
      className="min-h-screen w-full"
      style={{
        background:
          'linear-gradient(180deg, #efefec 0%, #f5f4ef 100%)',
      }}
    >
      <EmbedAutoHeightReporter />

      <div className={`mx-auto max-w-[1260px] ${minimal ? 'px-3 py-4 sm:px-4' : 'px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10'}`}>
      {!minimal ? (
          <section className="mb-7">
            <div className="text-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">
                <CalendarClock className="h-3.5 w-3.5" />
                Live Timetable
              </span>
              <h1 className="mt-4 text-4xl font-black tracking-[0.08em] text-slate-900 sm:text-5xl">
                診所應診時間表
              </h1>
              <p className="mt-3 text-sm font-medium tracking-[0.04em] text-slate-600 sm:text-base">
                由 Supabase 排班自動生成，最後同步：{generatedAtLabel}
              </p>
            </div>
            <DoctorStrip />

            {notices.length > 0 ? (
              <div className="mt-6 rounded-[28px] border border-white/75 bg-white/72 px-5 py-5 shadow-[0_22px_55px_-42px_rgba(15,23,42,0.38)] backdrop-blur-sm">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.34em] text-slate-500">
                  <Clock3 className="h-4 w-4" />
                  近期特別休診
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  {notices.map((notice) => (
                    <div
                      key={notice.id}
                      className="rounded-full border border-slate-200 bg-[#faf8f1] px-4 py-2 text-sm font-semibold text-slate-700 shadow-[0_12px_26px_-24px_rgba(15,23,42,0.45)]"
                    >
                      {[notice.doctorNameZh, notice.clinicNameZh].filter(Boolean).join(' ・ ') || '全診所安排'}
                      <span className="mx-2 text-slate-300">|</span>
                      {notice.dateLabel}
                      {notice.timeLabel ? ` ${notice.timeLabel}` : ' 全日休診'}
                      <span className="mx-2 text-slate-300">|</span>
                      {notice.reason}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-6">
              <p className="text-center text-sm font-semibold text-slate-600">選擇時間表月份（按入先可入）：</p>
              <div className="mx-auto mt-4 grid max-w-lg grid-cols-2 gap-4">
                {monthOptions.map((option) => (
                  <a
                    key={option.value}
                    href={buildMonthHref(option.value, minimal, clinicFilter)}
                    className={`group flex flex-col items-center justify-center rounded-[24px] border px-4 py-5 transition ${
                      option.isActive
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-700 shadow-[0_22px_40px_-24px_rgba(16,185,129,0.5)]'
                        : 'border-white/80 bg-white/85 text-slate-600 hover:border-emerald-200 hover:bg-emerald-50'
                    }`}
                  >
                    <CalendarDays className={`h-12 w-12 ${option.isActive ? 'text-emerald-600' : 'text-slate-500'}`} />
                    <span className="mt-2 text-2xl font-black tracking-[0.06em]">{option.label}</span>
                  </a>
                ))}
              </div>
              <p className="mt-3 text-center text-xs text-slate-500">目前查看版本：{activeMonthLabel}</p>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-3 text-sm text-slate-600">
              <a
                href={buildBookingUrl()}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
              >
                立即預約
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </section>
        ) : null}

        <div className="space-y-8">
          {visibleCards.map((card) => (
            <ClinicCard key={card.clinicId} card={card} />
          ))}
        </div>
        </div>
      </main>
  );
}
