export type ChatwootCampaignContext = {
  title: string;
  label?: string;
  sentAt?: string;
  source?: string;
  messagePreview?: string;
};

export type CampaignRecipient = {
  patientName: string;
  phone: string;
};

const PHONE_HEADERS = new Set([
  'phone',
  'mobile',
  'whatsapp',
  'whatsapp phone',
  '電話',
  '電話號碼',
  '手機',
  'whatsapp電話',
]);

const NAME_HEADERS = new Set([
  'name',
  'patient',
  'patient name',
  'patientname',
  '姓名',
  '病人',
  '病人姓名',
]);

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === ',' && !quoted) {
      cells.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function findHeaderIndex(headers: string[], candidates: Set<string>): number {
  return headers.findIndex((header) => candidates.has(normalizeHeader(header)));
}

export function parseCampaignRecipientCsv(csv: string): CampaignRecipient[] {
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return [];
  }

  const headers = parseCsvLine(lines[0] || '');
  const phoneIndex = findHeaderIndex(headers, PHONE_HEADERS);
  const nameIndex = findHeaderIndex(headers, NAME_HEADERS);

  if (phoneIndex < 0) {
    throw new Error('CSV must include a phone or WhatsApp column');
  }

  return lines.slice(1).flatMap((line) => {
    const cells = parseCsvLine(line);
    const phone = (cells[phoneIndex] || '').trim();

    if (!phone) {
      return [];
    }

    return [{
      patientName: nameIndex >= 0 ? (cells[nameIndex] || '').trim() : '',
      phone,
    }];
  });
}

export function buildCampaignContextNote(context: ChatwootCampaignContext): string {
  const lines = [
    `群發上下文：${context.title}`,
    context.sentAt ? `發送時間：${context.sentAt}` : '',
    context.source ? `來源：${context.source}` : '',
    '病人如回覆「報名」或查詢價錢 / 日期，請視為正在回覆以上群發。',
    context.messagePreview ? `群發內容預覽：${context.messagePreview}` : '',
  ];

  return lines.filter(Boolean).join('\n');
}

export function mergeCampaignLabels(existingLabels: string[] | undefined, label: string | undefined): string[] {
  const cleanLabel = label?.trim();
  if (!cleanLabel) {
    return existingLabels || [];
  }

  return Array.from(new Set([...(existingLabels || []), cleanLabel]));
}
