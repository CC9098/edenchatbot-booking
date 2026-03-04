import { CLINICS, DOCTORS } from '@/shared/clinic-data';

const ISO_DATE_REGEX = /\b(20\d{2}-\d{2}-\d{2})\b/;
const MONTH_DAY_REGEX = /(\d{1,2})月(\d{1,2})(?:日|號|号)/;
const NEXT_WEEKDAY_REGEX = /下(?:個|个)?(?:星期|週|周)\s*([一二三四五六日天])/;
const EN_NEXT_WEEKDAY_REGEX =
  /\bnext\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i;
const TODAY_REGEX = /(今日|今天|而家|依家|today|now)/i;
const TOMORROW_REGEX = /(聽日|明日|明天|tomorrow)/i;

const SLOT_QUERY_KEYWORDS = [
  '有咩時間',
  '有乜時間',
  '有咩時段',
  '有乜時段',
  '咩時間',
  '乜時間',
  '咩時段',
  '乜時段',
  '幾點',
  '有位',
  '空位',
  'available',
  'slot',
  'slots',
  'time',
  'times',
];

const SHORT_AFFIRMATIVE_REPLIES = new Set([
  '係',
  '係呀',
  '係啊',
  '系',
  '系呀',
  '好',
  '好呀',
  '好啊',
  '可以',
  '可以呀',
  '可以啊',
  '要',
  '要呀',
  '要啊',
  '想',
  '想呀',
  '想啊',
  'ok',
  'okay',
  'yes',
  'sure',
]);

export interface BookingConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface BookingConversationContext {
  doctorNameZh?: string;
  clinicNameZh?: string;
  date?: string;
}

function normalizeLookupToken(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\s.'’"()\-_/]/g, '')
    .replace(/医师|醫生|医生/g, '醫師')
    .replace(/韩/g, '韓');
}

function normalizeIntentText(value: string): string {
  let normalized = value
    .toLowerCase()
    .replace(/[\s\u3000]/g, '')
    .replace(/[，。！？!?、,.；;:："“”'"`~\-()（）\[\]{}]/g, '');

  const replacements: Array<[RegExp, string]> = [
    [/预约/g, '預約'],
    [/取消预约/g, '取消預約'],
    [/医师|医生/g, '醫師'],
    [/挂号/g, '預約'],
    [/复诊/g, '覆診'],
    [/改签/g, '改期'],
    [/reschedule|rebook/g, '改期'],
    [/cancelappointment|cancelbooking|cancel/g, '取消'],
    [/appointment|booking|book|reserve|schedule/g, '預約'],
    [/doctor/g, '醫師'],
  ];

  for (const [pattern, next] of replacements) {
    normalized = normalized.replace(pattern, next);
  }

  return normalized;
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function parseIsoDate(date: string): Date | null {
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() !== month - 1
    || parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return parsed;
}

function formatIsoDate(date: Date): string {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

function addDays(date: string, days: number): string | undefined {
  const parsed = parseIsoDate(date);
  if (!parsed) return undefined;
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return formatIsoDate(parsed);
}

function getAnchorDateIso(anchorDate: string | Date = new Date()): string | undefined {
  if (typeof anchorDate === 'string') {
    return parseIsoDate(anchorDate) ? anchorDate : undefined;
  }

  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Hong_Kong',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(anchorDate);
}

function weekdayCharToNumber(value: string): number | undefined {
  const map: Record<string, number> = {
    日: 0,
    天: 0,
    一: 1,
    二: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
  };

  return map[value];
}

function weekdayNameToNumber(value: string): number | undefined {
  const map: Record<string, number> = {
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
    sunday: 0,
  };

  return map[value.toLowerCase()];
}

function resolveNextWeekday(anchorDateIso: string, weekday: number): string | undefined {
  const anchorDate = parseIsoDate(anchorDateIso);
  if (!anchorDate) return undefined;

  const anchorWeekday = anchorDate.getUTCDay();
  const deltaToSameWeekday = (weekday - anchorWeekday + 7) % 7;
  return addDays(anchorDateIso, deltaToSameWeekday === 0 ? 7 : deltaToSameWeekday);
}

function resolveMonthDay(anchorDateIso: string, month: number, day: number): string | undefined {
  const anchorDate = parseIsoDate(anchorDateIso);
  if (!anchorDate) return undefined;

  let candidateYear = anchorDate.getUTCFullYear();
  let candidate = parseIsoDate(`${candidateYear}-${pad2(month)}-${pad2(day)}`);

  if (!candidate) return undefined;
  if (candidate < anchorDate) {
    candidateYear += 1;
    candidate = parseIsoDate(`${candidateYear}-${pad2(month)}-${pad2(day)}`);
  }

  return candidate ? formatIsoDate(candidate) : undefined;
}

function buildDoctorAliasEntries(): Array<[string, string]> {
  const aliases: Record<string, string> = {};

  for (const doctor of DOCTORS) {
    const canonical = doctor.nameZh;
    const enShort = doctor.nameEn.replace(/^dr\.?\s*/i, '').trim();
    const zhSurname = canonical.slice(0, 1);

    const keys = new Set<string>([
      canonical,
      canonical.replace('醫師', ''),
      canonical.replace('醫師', '医师'),
      `${zhSurname}醫師`,
      `${zhSurname}医师`,
      doctor.nameEn,
      `dr ${enShort}`,
      `doctor ${enShort}`,
      enShort,
    ]);

    if (canonical.startsWith('韓')) {
      keys.add(canonical.replace(/^韓/, '韩'));
      keys.add('韓醫師');
      keys.add('韩医师');
      keys.add('韩医生');
    }

    for (const key of keys) {
      aliases[normalizeLookupToken(key)] = canonical;
    }
  }

  return Object.entries(aliases).sort((left, right) => right[0].length - left[0].length);
}

function buildClinicAliasEntries(): Array<[string, string]> {
  const aliases: Record<string, string> = {};

  for (const clinic of CLINICS) {
    aliases[normalizeLookupToken(clinic.nameZh)] = clinic.nameZh;
    aliases[normalizeLookupToken(clinic.nameEn)] = clinic.nameZh;
  }

  aliases[normalizeLookupToken('中环')] = '中環';
  aliases[normalizeLookupToken('铜锣湾')] = '中環';
  aliases[normalizeLookupToken('荃湾')] = '荃灣';
  aliases[normalizeLookupToken('线上')] = '網上';

  return Object.entries(aliases).sort((left, right) => right[0].length - left[0].length);
}

const DOCTOR_ALIAS_ENTRIES = buildDoctorAliasEntries();
const CLINIC_ALIAS_ENTRIES = buildClinicAliasEntries();

function findAliasMatch(text: string, entries: Array<[string, string]>): string | undefined {
  const normalized = normalizeLookupToken(text);
  if (!normalized) return undefined;

  for (const [alias, canonical] of entries) {
    if (normalized.includes(alias)) {
      return canonical;
    }
  }

  return undefined;
}

function findPreviousAssistantMessage(messages: BookingConversationMessage[]): BookingConversationMessage | undefined {
  for (let i = messages.length - 2; i >= 0; i -= 1) {
    if (messages[i]?.role === 'assistant') return messages[i];
  }

  return undefined;
}

export function hasAvailabilityFollowUpCue(text: string): boolean {
  const normalized = normalizeIntentText(text);
  if (!normalized) return false;

  return SLOT_QUERY_KEYWORDS.some((keyword) =>
    normalized.includes(normalizeIntentText(keyword))
  );
}

export function isShortAffirmativeBookingReply(text: string): boolean {
  const normalized = normalizeIntentText(text);
  if (!normalized || normalized.length > 12) return false;
  return SHORT_AFFIRMATIVE_REPLIES.has(normalized);
}

export function isClinicConfirmationAssistantMessage(text: string): boolean {
  const normalized = normalizeIntentText(text);
  if (!normalized) return false;

  const asksToConfirmClinic =
    normalized.includes(normalizeIntentText('係咪想預約'))
    || normalized.includes(normalizeIntentText('是否想預約'))
    || normalized.includes(normalizeIntentText('想唔想預約'))
    || normalized.includes(normalizeIntentText('想預約邊間診所'))
    || normalized.includes(normalizeIntentText('去邊間診所'));

  return asksToConfirmClinic && normalized.includes(normalizeIntentText('診所'));
}

export function isAvailabilityFollowUpMessage(messages: BookingConversationMessage[]): boolean {
  const latestUserMessage = [...messages].reverse().find((message) => message.role === 'user');
  if (!latestUserMessage) return false;

  if (hasAvailabilityFollowUpCue(latestUserMessage.content)) {
    return true;
  }

  if (!isShortAffirmativeBookingReply(latestUserMessage.content)) {
    return false;
  }

  const previousAssistant = findPreviousAssistantMessage(messages);
  if (!previousAssistant) return false;

  return isClinicConfirmationAssistantMessage(previousAssistant.content);
}

export function resolveDateFromBookingText(
  text: string,
  anchorDate: string | Date = new Date(),
): string | undefined {
  const anchorDateIso = getAnchorDateIso(anchorDate);
  if (!anchorDateIso) return undefined;

  const isoMatch = text.match(ISO_DATE_REGEX);
  if (isoMatch?.[1]) {
    return isoMatch[1];
  }

  const monthDayMatch = text.match(MONTH_DAY_REGEX);
  if (monthDayMatch?.[1] && monthDayMatch?.[2]) {
    const month = Number(monthDayMatch[1]);
    const day = Number(monthDayMatch[2]);
    if (Number.isFinite(month) && Number.isFinite(day)) {
      const resolved = resolveMonthDay(anchorDateIso, month, day);
      if (resolved) return resolved;
    }
  }

  const nextWeekdayMatch = text.match(NEXT_WEEKDAY_REGEX);
  if (nextWeekdayMatch?.[1]) {
    const weekday = weekdayCharToNumber(nextWeekdayMatch[1]);
    if (typeof weekday === 'number') {
      const resolved = resolveNextWeekday(anchorDateIso, weekday);
      if (resolved) return resolved;
    }
  }

  const englishWeekdayMatch = text.match(EN_NEXT_WEEKDAY_REGEX);
  if (englishWeekdayMatch?.[1]) {
    const weekday = weekdayNameToNumber(englishWeekdayMatch[1]);
    if (typeof weekday === 'number') {
      const resolved = resolveNextWeekday(anchorDateIso, weekday);
      if (resolved) return resolved;
    }
  }

  if (TOMORROW_REGEX.test(text)) {
    return addDays(anchorDateIso, 1);
  }

  if (TODAY_REGEX.test(text)) {
    return anchorDateIso;
  }

  return undefined;
}

export function extractBookingConversationContext(
  messages: BookingConversationMessage[],
  anchorDate: string | Date = new Date(),
): BookingConversationContext {
  let doctorNameZh: string | undefined;
  let clinicNameZh: string | undefined;
  let date: string | undefined;

  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    const content = message?.content || '';

    if (!doctorNameZh) {
      doctorNameZh = findAliasMatch(content, DOCTOR_ALIAS_ENTRIES);
    }

    if (!clinicNameZh) {
      clinicNameZh = findAliasMatch(content, CLINIC_ALIAS_ENTRIES);
    }

    if (!date) {
      date = resolveDateFromBookingText(content, anchorDate);
    }

    if (doctorNameZh && clinicNameZh && date) {
      break;
    }
  }

  return {
    ...(doctorNameZh ? { doctorNameZh } : {}),
    ...(clinicNameZh ? { clinicNameZh } : {}),
    ...(date ? { date } : {}),
  };
}
