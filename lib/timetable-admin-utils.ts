import type { WeeklySchedule, TimeRange } from '@/shared/schedule-config';

export const DAY_FIELD_ORDER = ['1', '2', '3', '4', '5', '6', '0'] as const;
export type DayFieldKey = (typeof DAY_FIELD_ORDER)[number];

export const DAY_LABELS_ZH: Record<DayFieldKey, string> = {
  '0': '週日',
  '1': '週一',
  '2': '週二',
  '3': '週三',
  '4': '週四',
  '5': '週五',
  '6': '週六',
};

export type DayInputMap = Record<DayFieldKey, string>;

const TIME_RANGE_REGEX = /^(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})$/;

function toMinutes(value: string): number {
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
}

export function normalizeDbTime(value: string | null | undefined): string | null {
  if (!value) return null;
  return String(value).slice(0, 5);
}

export function createEmptyDayInputs(): DayInputMap {
  return {
    '0': '',
    '1': '',
    '2': '',
    '3': '',
    '4': '',
    '5': '',
    '6': '',
  };
}

export function formatScheduleRanges(ranges: TimeRange[] | null | undefined): string {
  if (!ranges || ranges.length === 0) return '';
  return ranges.map((range) => `${range.start}-${range.end}`).join(', ');
}

export function weeklyScheduleToDayInputs(schedule: WeeklySchedule | null | undefined): DayInputMap {
  const next = createEmptyDayInputs();
  if (!schedule) return next;

  for (const dayKey of DAY_FIELD_ORDER) {
    next[dayKey] = formatScheduleRanges(schedule[Number(dayKey)]);
  }

  return next;
}

export function parseDayRangesInput(input: string, label: string): TimeRange[] | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const parts = trimmed
    .split(/[,\n]/g)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) return null;

  const ranges: TimeRange[] = [];
  let previousEnd = -1;

  for (const part of parts) {
    const match = TIME_RANGE_REGEX.exec(part);
    if (!match) {
      throw new Error(`${label} 格式需為 HH:mm-HH:mm，可用逗號分隔多段`);
    }

    const start = match[1];
    const end = match[2];
    const startMin = toMinutes(start);
    const endMin = toMinutes(end);

    if (startMin >= endMin) {
      throw new Error(`${label} 時段開始時間必須早於結束時間`);
    }

    if (previousEnd > startMin) {
      throw new Error(`${label} 時段不可重疊，請按先後排列`);
    }

    previousEnd = endMin;
    ranges.push({ start, end });
  }

  return ranges;
}

export function buildWeeklyScheduleFromDayInputs(dayInputs: DayInputMap): WeeklySchedule {
  const schedule: WeeklySchedule = {
    0: null,
    1: null,
    2: null,
    3: null,
    4: null,
    5: null,
    6: null,
  };

  for (const dayKey of DAY_FIELD_ORDER) {
    schedule[Number(dayKey)] = parseDayRangesInput(dayInputs[dayKey], DAY_LABELS_ZH[dayKey]);
  }

  return schedule;
}
