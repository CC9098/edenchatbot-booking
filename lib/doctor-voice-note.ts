export interface SymptomExtraction {
  chiefComplaint: string;
  presentIllnessSummary: string;
  associatedSymptoms: string[];
  negativeSymptoms: string[];
  durationAndCourse: string;
  otherRecordableFindings: string[];
  verificationItems: string[];
}

export interface PatientContext {
  patientUserId: string;
  patientDisplayName: string;
  patientPhone: string;
}

export const EMPTY_SYMPTOM_EXTRACTION: SymptomExtraction = {
  chiefComplaint: "",
  presentIllnessSummary: "",
  associatedSymptoms: [],
  negativeSymptoms: [],
  durationAndCourse: "",
  otherRecordableFindings: [],
  verificationItems: [],
};

export function sanitizeVoiceNoteText(value: unknown, maxLength = 800): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

export function sanitizeVoiceNoteList(
  value: unknown,
  maxItems = 12,
  maxItemLength = 180,
): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => sanitizeVoiceNoteText(item, maxItemLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

export function buildPatientHeader(patient: PatientContext): string[] {
  const hasAnyPatientInfo = Boolean(
    patient.patientUserId || patient.patientDisplayName || patient.patientPhone,
  );
  if (!hasAnyPatientInfo) return [];

  return [
    `病人ID：${patient.patientUserId || "未提供"}`,
    `病人姓名：${patient.patientDisplayName || "未提供"}`,
    `病人電話：${patient.patientPhone || "未提供"}`,
  ];
}

export function normalizeSymptomExtraction(data: Record<string, unknown> | null): SymptomExtraction {
  if (!data) return EMPTY_SYMPTOM_EXTRACTION;

  return {
    chiefComplaint: sanitizeVoiceNoteText(data.chiefComplaint, 240),
    presentIllnessSummary: sanitizeVoiceNoteText(data.presentIllnessSummary, 1200),
    associatedSymptoms: sanitizeVoiceNoteList(data.associatedSymptoms),
    negativeSymptoms: sanitizeVoiceNoteList(data.negativeSymptoms),
    durationAndCourse: sanitizeVoiceNoteText(data.durationAndCourse, 500),
    otherRecordableFindings: sanitizeVoiceNoteList(data.otherRecordableFindings),
    verificationItems: sanitizeVoiceNoteList(data.verificationItems),
  };
}

export function formatVoiceNoteList(items: string[]): string {
  if (items.length === 0) return "未明確提及";
  return items.map((item, index) => `${index + 1}. ${item}`).join("\n");
}

export function buildRecordText(extraction: SymptomExtraction, patient: PatientContext): string {
  const patientHeader = buildPatientHeader(patient);
  return [
    ...(patientHeader.length > 0 ? [...patientHeader, ""] : []),
    `主訴：${extraction.chiefComplaint || "未明確提及"}`,
    "",
    `現病史摘要：${extraction.presentIllnessSummary || "未明確提及"}`,
    "",
    `伴隨症狀：\n${formatVoiceNoteList(extraction.associatedSymptoms)}`,
    "",
    `否認症狀：\n${formatVoiceNoteList(extraction.negativeSymptoms)}`,
    "",
    `病程/時長：${extraction.durationAndCourse || "未明確提及"}`,
    "",
    `其他可記錄觀察：\n${formatVoiceNoteList(extraction.otherRecordableFindings)}`,
    "",
    `待醫師確認：\n${formatVoiceNoteList(extraction.verificationItems)}`,
  ].join("\n");
}

function splitOversizedBlock(block: string, maxChars: number): string[] {
  const trimmed = block.trim();
  if (!trimmed) return [];
  if (trimmed.length <= maxChars) return [trimmed];

  const sentences = trimmed
    .split(/(?<=[。！？!?；;])\s*/u)
    .map((item) => item.trim())
    .filter(Boolean);

  if (sentences.length <= 1) {
    const chunks: string[] = [];
    for (let start = 0; start < trimmed.length; start += maxChars) {
      chunks.push(trimmed.slice(start, start + maxChars));
    }
    return chunks;
  }

  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    if (sentence.length > maxChars) {
      if (current) {
        chunks.push(current);
        current = "";
      }
      chunks.push(...splitOversizedBlock(sentence, maxChars));
      continue;
    }

    const candidate = current ? `${current} ${sentence}` : sentence;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }

    if (current) chunks.push(current);
    current = sentence;
  }

  if (current) chunks.push(current);
  return chunks;
}

export function splitTranscriptIntoSegments(transcript: string, maxChars = 12_000): string[] {
  const trimmed = transcript.trim();
  if (!trimmed) return [];
  if (trimmed.length <= maxChars) return [trimmed];

  const paragraphUnits = trimmed
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean)
    .flatMap((item) => splitOversizedBlock(item, maxChars));

  const units = paragraphUnits.length > 0 ? paragraphUnits : splitOversizedBlock(trimmed, maxChars);
  const segments: string[] = [];
  let current = "";

  for (const unit of units) {
    if (!unit) continue;
    const candidate = current ? `${current}\n\n${unit}` : unit;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }

    if (current) segments.push(current);
    current = unit;
  }

  if (current) segments.push(current);
  return segments;
}

function dedupeOrdered(items: string[], maxItems = 12, maxItemLength = 180): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];

  for (const rawItem of items) {
    const item = sanitizeVoiceNoteText(rawItem, maxItemLength);
    if (!item) continue;

    const normalizedKey = item.replace(/\s+/g, " ").toLowerCase();
    if (seen.has(normalizedKey)) continue;

    seen.add(normalizedKey);
    deduped.push(item);
    if (deduped.length >= maxItems) break;
  }

  return deduped;
}

function joinUniqueTextSegments(values: string[], maxLength: number): string {
  const parts = dedupeOrdered(values, 12, maxLength);
  if (parts.length === 0) return "";

  let combined = "";
  for (const part of parts) {
    const candidate = combined ? `${combined}；${part}` : part;
    if (candidate.length > maxLength) {
      return combined || part.slice(0, maxLength);
    }
    combined = candidate;
  }

  return combined;
}

export function mergeSymptomExtractions(extractions: SymptomExtraction[]): SymptomExtraction {
  const validExtractions = extractions.filter(Boolean);
  if (validExtractions.length === 0) return EMPTY_SYMPTOM_EXTRACTION;

  return {
    chiefComplaint:
      validExtractions.map((item) => item.chiefComplaint.trim()).find(Boolean)?.slice(0, 240) || "",
    presentIllnessSummary: joinUniqueTextSegments(
      validExtractions.map((item) => item.presentIllnessSummary),
      1200,
    ),
    associatedSymptoms: dedupeOrdered(
      validExtractions.flatMap((item) => item.associatedSymptoms),
      12,
      180,
    ),
    negativeSymptoms: dedupeOrdered(
      validExtractions.flatMap((item) => item.negativeSymptoms),
      12,
      180,
    ),
    durationAndCourse: joinUniqueTextSegments(
      validExtractions.map((item) => item.durationAndCourse),
      500,
    ),
    otherRecordableFindings: dedupeOrdered(
      validExtractions.flatMap((item) => item.otherRecordableFindings),
      12,
      180,
    ),
    verificationItems: dedupeOrdered(
      validExtractions.flatMap((item) => item.verificationItems),
      12,
      180,
    ),
  };
}
