import fs from "node:fs/promises";
import path from "node:path";

import { createServiceClient } from "@/lib/supabase";
import type {
  StaffKnowledgeChatAnswer,
  StaffKnowledgeDocument,
  StaffKnowledgeSearchResult,
  StaffKnowledgeSensitivity,
  StaffKnowledgeStatus,
} from "@/lib/staff-knowledge-base-types";

const KNOWLEDGE_ROOT = path.join(process.cwd(), "docs", "staff-knowledge-base");
const STAFF_KNOWLEDGE_NOTE_TAG = "staff-knowledge";
const STAFF_KNOWLEDGE_SOURCE_HASH = "staff-knowledge-note";
const STAFF_KNOWLEDGE_IMPORT_SOURCE_HASH_PREFIX = "staff-knowledge-import:";
const STAFF_IMPORTED_DOCUMENT_TAG_PREFIX = "staff-import:";
const STAFF_CATEGORY_TAG_PREFIX = "staff-category:";
const STAFF_SENSITIVITY_TAG_PREFIX = "staff-sensitivity:";

const CATEGORY_BY_PREFIX: Array<[string, string]> = [
  ["patient-enquiries/", "病人查詢回覆"],
  ["notion-live/whatsapp-replies/", "WhatsApp 回覆範本"],
  ["notion-import/eden-series/", "EDEN姑娘系列"],
  ["notion-import/edengram/", "EDENGRAM"],
  ["00-intake-index", "知識庫目錄"],
  ["security-and-credentials", "安全與權限"],
];

const CATEGORY_BY_CONTENT: Array<[RegExp, string]> = [
  [/醫療券|醫健通/i, "醫療券"],
  [/寄藥|送藥|寄收據|lalamove|順豐|海外郵寄/i, "寄藥"],
  [/收據|病假紙|到診紙|醫療報告|分單|價目|零售價|收費|醫療廢物/i, "文件 / 收費"],
  [/藥袋|食藥|藥方|訂藥|代煎|藥膏|外用藥|重配|藥丸|精油|天灸|lifaair/i, "藥物 / 處方"],
  [/上班時間|開診前|假期|颱風|病假|放長年假|wifi|飛線|留言|同工電郵|醫師卡片|蕉印|qr code|apowersoft/i, "診所日常"],
  [/招呼|入房|基本對話|英文|介紹|回應處理/i, "病人接待"],
];

const STATUS_VALUES = new Set<StaffKnowledgeStatus>([
  "seed",
  "placeholder",
  "draft",
  "reviewed",
]);

const SENSITIVITY_VALUES = new Set<StaffKnowledgeSensitivity>([
  "public",
  "internal",
  "restricted",
]);

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/\r/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toTitle(contentMd: string, fallback: string): string {
  const match = contentMd.match(/^#\s+(.+)$/m);
  return match?.[1]?.trim() || fallback;
}

function toCategory(relativePath: string): string {
  for (const [prefix, category] of CATEGORY_BY_PREFIX) {
    if (relativePath.startsWith(prefix)) return category;
  }
  return "姑娘內部手冊";
}

function toDocumentCategory(
  contentMd: string,
  relativePath: string,
  title: string,
): string {
  const explicitCategory = parseMetadataValue(contentMd, "分類") || parseMetadataValue(contentMd, "類別");
  if (explicitCategory) return explicitCategory.slice(0, 80);

  if (relativePath.startsWith("00-intake-index") || relativePath.startsWith("security-and-credentials")) {
    return toCategory(relativePath);
  }
  if (relativePath.startsWith("patient-enquiries/")) return "病人查詢";
  if (relativePath.startsWith("notion-live/whatsapp-replies/")) return "WhatsApp 回覆";

  const searchable = [
    relativePath,
    title,
    compactMarkdown(contentMd, 600),
  ].join("\n");
  for (const [pattern, category] of CATEGORY_BY_CONTENT) {
    if (pattern.test(searchable)) return category;
  }

  if (relativePath.startsWith("notion-import/eden-series/")) return "前台流程";
  if (relativePath.startsWith("notion-import/edengram/")) return "診所工具";
  return toCategory(relativePath);
}

function parseMetadataValue(
  contentMd: string,
  label: string,
): string | null {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`\\|\\s*${escapedLabel}\\s*\\|\\s*([^|]+)\\|`);
  return contentMd.match(pattern)?.[1]?.trim() || null;
}

function parseStatus(contentMd: string): StaffKnowledgeStatus {
  const raw = parseMetadataValue(contentMd, "狀態")?.toLowerCase();
  if (raw && STATUS_VALUES.has(raw as StaffKnowledgeStatus)) {
    return raw as StaffKnowledgeStatus;
  }
  return "draft";
}

function parseSensitivity(contentMd: string): StaffKnowledgeSensitivity {
  const raw = parseMetadataValue(contentMd, "敏感度")?.toLowerCase();
  if (raw && SENSITIVITY_VALUES.has(raw as StaffKnowledgeSensitivity)) {
    return raw as StaffKnowledgeSensitivity;
  }
  return "internal";
}

function compactMarkdown(value: string, maxChars = 160): string {
  const normalized = value
    .replace(/^#.*$/gm, "")
    .replace(/\|.*\|/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/[*_>#]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, maxChars - 1).trimEnd()}…`;
}

function toIsoDateLabel(value: string | null | undefined): string {
  if (!value) return "未標記";
  return value.slice(0, 10);
}

function extractSection(contentMd: string, headingPattern: RegExp): string | null {
  const lines = contentMd.replace(/\r/g, "").split("\n");
  const startIndex = lines.findIndex((line) => headingPattern.test(line.trim()));
  if (startIndex < 0) return null;

  const sectionLines: string[] = [];
  for (let i = startIndex + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.startsWith("## ")) break;
    sectionLines.push(line);
  }

  const section = sectionLines.join("\n").trim();
  return section || null;
}

function splitIntoSearchBlocks(contentMd: string): string[] {
  return contentMd
    .replace(/\r/g, "")
    .split(/\n{2,}/g)
    .map((block) => block.trim())
    .filter((block) => {
      if (!block) return false;
      if (block.startsWith("| 欄位 |")) return false;
      if (block.startsWith("| --- |")) return false;
      return compactMarkdown(block, 500).length >= 8;
    });
}

function buildSearchTerms(query: string): string[] {
  const normalized = normalizeText(query);
  const terms = new Set<string>();

  for (const part of normalized.split(" ")) {
    if (part.length >= 2) terms.add(part);
  }

  const cjkOnly = query.replace(/[^\p{Script=Han}]/gu, "");
  for (let size = 2; size <= 4; size += 1) {
    for (let i = 0; i <= cjkOnly.length - size; i += 1) {
      terms.add(cjkOnly.slice(i, i + size));
    }
  }

  return Array.from(terms).slice(0, 36);
}

function scoreText(text: string, terms: string[], rawQuery: string): number {
  const normalizedText = normalizeText(text);
  const normalizedQuery = normalizeText(rawQuery);
  let score = normalizedQuery && normalizedText.includes(normalizedQuery) ? 12 : 0;

  for (const term of terms) {
    if (!term) continue;
    if (normalizedText.includes(normalizeText(term))) {
      score += term.length >= 4 ? 5 : 3;
    }
  }

  return score;
}

function pickSnippets(document: StaffKnowledgeDocument, terms: string[], query: string): string[] {
  return splitIntoSearchBlocks(document.contentMd)
    .map((block) => ({
      block,
      score: scoreText(block, terms, query),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((item) => compactMarkdown(item.block, 260));
}

function documentSearchWeight(documentId: string): number {
  if (documentId === "00-intake-index") return 0.3;
  if (documentId === "security-and-credentials") return 0.3;
  return 1;
}

async function collectMarkdownFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectMarkdownFiles(fullPath));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".md") && entry.name !== "README.md") {
      files.push(fullPath);
    }
  }

  return files;
}

export interface StaffKnowledgeNoteRow {
  id: string;
  title: string;
  body_md: string;
  status: "inbox" | "drafting" | "ready" | "published" | "archived";
  source: "manual" | "article_sync" | "ai_assist";
  tags: string[] | null;
  source_hash: string | null;
  is_active: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface StaffKnowledgeNoteInput {
  title: string;
  category: string;
  contentMd: string;
  sensitivity: StaffKnowledgeSensitivity;
}

function normalizeNoteField(value: string, fallback: string, maxLength: number): string {
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) return fallback;
  return trimmed.slice(0, maxLength);
}

function normalizeNoteContent(value: string): string {
  return value.replace(/\r/g, "").trim().slice(0, 50000);
}

function parseNoteCategory(tags: string[] | null): string {
  const tag = tags?.find((item) => item.startsWith(STAFF_CATEGORY_TAG_PREFIX));
  return tag?.slice(STAFF_CATEGORY_TAG_PREFIX.length).trim() || "姑娘新增 Note";
}

function parseNoteSensitivity(tags: string[] | null): StaffKnowledgeSensitivity {
  const tag = tags?.find((item) => item.startsWith(STAFF_SENSITIVITY_TAG_PREFIX));
  const raw = tag?.slice(STAFF_SENSITIVITY_TAG_PREFIX.length).trim();
  if (raw && SENSITIVITY_VALUES.has(raw as StaffKnowledgeSensitivity)) {
    return raw as StaffKnowledgeSensitivity;
  }
  return "internal";
}

function toNoteStatus(status: StaffKnowledgeNoteRow["status"]): StaffKnowledgeStatus {
  if (status === "published" || status === "ready") return "reviewed";
  if (status === "archived") return "draft";
  return "draft";
}

function buildImportedDocumentSourceHash(documentId: string): string {
  return `${STAFF_KNOWLEDGE_IMPORT_SOURCE_HASH_PREFIX}${documentId}`;
}

function parseImportedDocumentId(row: StaffKnowledgeNoteRow): string | null {
  if (!row.source_hash?.startsWith(STAFF_KNOWLEDGE_IMPORT_SOURCE_HASH_PREFIX)) return null;
  return row.source_hash.slice(STAFF_KNOWLEDGE_IMPORT_SOURCE_HASH_PREFIX.length);
}

function buildNoteTags(
  category: string,
  sensitivity: StaffKnowledgeSensitivity,
  existingTags: string[] = [],
  extraTags: string[] = [],
): string[] {
  const preserved = existingTags
    .filter((tag) => {
      return (
        tag !== STAFF_KNOWLEDGE_NOTE_TAG &&
        !tag.startsWith(STAFF_IMPORTED_DOCUMENT_TAG_PREFIX) &&
        !tag.startsWith(STAFF_CATEGORY_TAG_PREFIX) &&
        !tag.startsWith(STAFF_SENSITIVITY_TAG_PREFIX)
      );
    })
    .map((tag) => tag.trim().slice(0, 80))
    .filter(Boolean);

  return Array.from(new Set([
    STAFF_KNOWLEDGE_NOTE_TAG,
    `${STAFF_CATEGORY_TAG_PREFIX}${category}`,
    `${STAFF_SENSITIVITY_TAG_PREFIX}${sensitivity}`,
    ...extraTags,
    ...preserved,
  ])).slice(0, 12);
}

function mapNoteRowToDocument(row: StaffKnowledgeNoteRow): StaffKnowledgeDocument {
  const category = parseNoteCategory(row.tags);
  const sensitivity = parseNoteSensitivity(row.tags);
  const contentMd = row.body_md || "";
  const patientReplyMd = extractSection(
    contentMd,
    /^##\s+(病人|病人\/客戶).*可見回覆/,
  );

  return {
    id: `note:${row.id}`,
    noteId: row.id,
    title: row.title,
    category,
    status: toNoteStatus(row.status),
    sensitivity,
    source: "姑娘新增 Note",
    updatedAt: toIsoDateLabel(row.updated_at),
    createdAt: row.created_at,
    updatedBy: row.updated_by,
    excerpt: compactMarkdown(contentMd),
    contentMd,
    patientReplyMd,
    sourcePath: `knowledge_cards:${row.id}`,
    tags: Array.from(new Set([category, "editable", sensitivity, ...(row.tags || [])])),
    editable: true,
    imported: false,
  };
}

function mapImportedRowToDocument(
  baseDocument: StaffKnowledgeDocument,
  row?: StaffKnowledgeNoteRow,
): StaffKnowledgeDocument {
  if (!row) {
    return {
      ...baseDocument,
      editable: true,
      imported: true,
    };
  }

  const category = parseNoteCategory(row.tags);
  const sensitivity = parseNoteSensitivity(row.tags);
  const contentMd = row.body_md || "";
  const patientReplyMd = extractSection(
    contentMd,
    /^##\s+(病人|病人\/客戶).*可見回覆/,
  );

  return {
    ...baseDocument,
    noteId: row.id,
    title: row.title,
    category,
    status: toNoteStatus(row.status),
    sensitivity,
    updatedAt: toIsoDateLabel(row.updated_at),
    createdAt: row.created_at,
    updatedBy: row.updated_by,
    excerpt: compactMarkdown(contentMd),
    contentMd,
    patientReplyMd,
    tags: Array.from(new Set([category, "editable", sensitivity, ...(row.tags || [])])),
    editable: true,
    imported: true,
  };
}

export function mergeImportedStaffKnowledgeDocuments(
  importedDocuments: StaffKnowledgeDocument[],
  rows: StaffKnowledgeNoteRow[],
): StaffKnowledgeDocument[] {
  const rowsByImportedId = new Map<string, StaffKnowledgeNoteRow>();

  for (const row of rows) {
    const importedId = parseImportedDocumentId(row);
    if (!importedId) continue;
    const current = rowsByImportedId.get(importedId);
    if (!current || row.updated_at > current.updated_at) {
      rowsByImportedId.set(importedId, row);
    }
  }

  return importedDocuments.flatMap((document) => {
    const row = rowsByImportedId.get(document.id);
    if (row?.status === "archived") return [];
    return [mapImportedRowToDocument(document, row)];
  });
}

async function listStaffKnowledgeNoteRows(): Promise<StaffKnowledgeNoteRow[]> {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("knowledge_cards")
      .select("id, title, body_md, status, source, tags, source_hash, is_active, created_by, updated_by, created_at, updated_at")
      .contains("tags", [STAFF_KNOWLEDGE_NOTE_TAG])
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(500);

    if (error) {
      console.error("[staff-knowledge] failed to list editable notes:", error.message);
      return [];
    }

    return (data || []) as StaffKnowledgeNoteRow[];
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Missing SUPABASE_")) {
      return [];
    }
    console.error("[staff-knowledge] editable notes unavailable:", error);
    return [];
  }
}

function mapManualStaffKnowledgeRows(rows: StaffKnowledgeNoteRow[]): StaffKnowledgeDocument[] {
  return rows
    .filter((row) => !parseImportedDocumentId(row))
    .filter((row) => row.status !== "archived")
    .map(mapNoteRowToDocument);
}

function prepareNoteInput(input: StaffKnowledgeNoteInput) {
  const title = normalizeNoteField(input.title, "", 180);
  if (!title) {
    throw new Error("請輸入標題");
  }

  const category = normalizeNoteField(input.category, "姑娘新增 Note", 80);
  const contentMd = normalizeNoteContent(input.contentMd);
  if (!contentMd) {
    throw new Error("請輸入內容");
  }

  const sensitivity = SENSITIVITY_VALUES.has(input.sensitivity)
    ? input.sensitivity
    : "internal";

  return {
    title,
    category,
    contentMd,
    sensitivity,
  };
}

export async function createStaffKnowledgeNote(
  input: StaffKnowledgeNoteInput,
  userId: string,
): Promise<StaffKnowledgeDocument> {
  const prepared = prepareNoteInput(input);
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("knowledge_cards")
    .insert({
      title: prepared.title,
      body_md: prepared.contentMd,
      status: "ready",
      source: "manual",
      tags: buildNoteTags(prepared.category, prepared.sensitivity),
      source_hash: STAFF_KNOWLEDGE_SOURCE_HASH,
      sort_order: 0,
      is_active: true,
      created_by: userId,
      updated_by: userId,
    })
    .select("id, title, body_md, status, source, tags, source_hash, is_active, created_by, updated_by, created_at, updated_at")
    .single();

  if (error || !data) {
    console.error("[staff-knowledge] create note failed:", error?.message);
    throw new Error("未能建立 Note");
  }

  return mapNoteRowToDocument(data as StaffKnowledgeNoteRow);
}

export async function updateStaffKnowledgeNote(
  noteId: string,
  input: StaffKnowledgeNoteInput,
  userId: string,
): Promise<StaffKnowledgeDocument> {
  const prepared = prepareNoteInput(input);
  const supabase = createServiceClient();

  const { data: existing, error: existingError } = await supabase
    .from("knowledge_cards")
    .select("id, tags")
    .eq("id", noteId)
    .contains("tags", [STAFF_KNOWLEDGE_NOTE_TAG])
    .eq("is_active", true)
    .maybeSingle();

  if (existingError) {
    console.error("[staff-knowledge] fetch note before update failed:", existingError.message);
    throw new Error("未能讀取 Note");
  }
  if (!existing) {
    throw new Error("找不到可編輯 Note");
  }

  const { data, error } = await supabase
    .from("knowledge_cards")
    .update({
      title: prepared.title,
      body_md: prepared.contentMd,
      tags: buildNoteTags(prepared.category, prepared.sensitivity, Array.isArray(existing.tags) ? existing.tags : []),
      updated_by: userId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", noteId)
    .contains("tags", [STAFF_KNOWLEDGE_NOTE_TAG])
    .select("id, title, body_md, status, source, tags, source_hash, is_active, created_by, updated_by, created_at, updated_at")
    .single();

  if (error || !data) {
    console.error("[staff-knowledge] update note failed:", error?.message);
    throw new Error("未能更新 Note");
  }

  return mapNoteRowToDocument(data as StaffKnowledgeNoteRow);
}

async function listImportedStaffKnowledgeDocuments(): Promise<StaffKnowledgeDocument[]> {
  const filePaths = await collectMarkdownFiles(KNOWLEDGE_ROOT);
  return Promise.all(
    filePaths.map(async (filePath) => {
      const contentMd = await fs.readFile(filePath, "utf8");
      const relativePath = path.relative(KNOWLEDGE_ROOT, filePath).replace(/\\/g, "/");
      const id = relativePath.replace(/\.md$/, "");
      const title = toTitle(contentMd, path.basename(filePath, ".md"));
      const category = toDocumentCategory(contentMd, relativePath, title);
      const patientReplyMd = extractSection(
        contentMd,
        /^##\s+(病人|病人\/客戶).*可見回覆/,
      );

      return {
        id,
        title,
        category,
        status: parseStatus(contentMd),
        sensitivity: parseSensitivity(contentMd),
        source: parseMetadataValue(contentMd, "來源") || "staff-knowledge-base",
        updatedAt: parseMetadataValue(contentMd, "最後整理") || "未標記",
        excerpt: compactMarkdown(contentMd),
        contentMd,
        patientReplyMd,
        sourcePath: `docs/staff-knowledge-base/${relativePath}`,
        tags: Array.from(new Set([category, toCategory(relativePath), parseStatus(contentMd), parseSensitivity(contentMd)])),
        editable: true,
        imported: true,
      } satisfies StaffKnowledgeDocument;
    }),
  );
}

async function getImportedStaffKnowledgeDocument(documentId: string): Promise<StaffKnowledgeDocument> {
  const documents = await listImportedStaffKnowledgeDocuments();
  const document = documents.find((item) => item.id === documentId);
  if (!document) {
    throw new Error("找不到匯入檔");
  }
  return document;
}

export async function listStaffKnowledgeDocuments(): Promise<StaffKnowledgeDocument[]> {
  const importedDocuments = await listImportedStaffKnowledgeDocuments();
  const noteRows = await listStaffKnowledgeNoteRows();
  const noteDocuments = mapManualStaffKnowledgeRows(noteRows);
  const visibleImportedDocuments = mergeImportedStaffKnowledgeDocuments(importedDocuments, noteRows);
  const documents = [...noteDocuments, ...visibleImportedDocuments];

  return documents.sort((a, b) => {
    if (a.editable !== b.editable) return a.editable ? -1 : 1;
    if (a.category !== b.category) return a.category.localeCompare(b.category, "zh-HK");
    return a.title.localeCompare(b.title, "zh-HK");
  });
}

export async function updateImportedStaffKnowledgeDocument(
  documentId: string,
  input: StaffKnowledgeNoteInput,
  userId: string,
): Promise<StaffKnowledgeDocument> {
  const importedDocument = await getImportedStaffKnowledgeDocument(documentId);
  const prepared = prepareNoteInput(input);
  const supabase = createServiceClient();
  const sourceHash = buildImportedDocumentSourceHash(documentId);
  const importedTag = `${STAFF_IMPORTED_DOCUMENT_TAG_PREFIX}${documentId}`.slice(0, 80);

  const { data: existing, error: existingError } = await supabase
    .from("knowledge_cards")
    .select("id, tags")
    .eq("source_hash", sourceHash)
    .contains("tags", [STAFF_KNOWLEDGE_NOTE_TAG])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    console.error("[staff-knowledge] fetch imported document before update failed:", existingError.message);
    throw new Error("未能讀取匯入檔");
  }

  if (existing) {
    const { data, error } = await supabase
      .from("knowledge_cards")
      .update({
        title: prepared.title,
        body_md: prepared.contentMd,
        status: "ready",
        source: "manual",
        tags: buildNoteTags(
          prepared.category,
          prepared.sensitivity,
          Array.isArray(existing.tags) ? existing.tags : [],
          [importedTag],
        ),
        source_hash: sourceHash,
        is_active: true,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select("id, title, body_md, status, source, tags, source_hash, is_active, created_by, updated_by, created_at, updated_at")
      .single();

    if (error || !data) {
      console.error("[staff-knowledge] update imported document failed:", error?.message);
      throw new Error("未能更新匯入檔");
    }

    return mapImportedRowToDocument(importedDocument, data as StaffKnowledgeNoteRow);
  }

  const { data, error } = await supabase
    .from("knowledge_cards")
    .insert({
      title: prepared.title,
      body_md: prepared.contentMd,
      status: "ready",
      source: "manual",
      tags: buildNoteTags(prepared.category, prepared.sensitivity, [], [importedTag]),
      source_hash: sourceHash,
      sort_order: 0,
      is_active: true,
      created_by: userId,
      updated_by: userId,
    })
    .select("id, title, body_md, status, source, tags, source_hash, is_active, created_by, updated_by, created_at, updated_at")
    .single();

  if (error || !data) {
    console.error("[staff-knowledge] create imported document override failed:", error?.message);
    throw new Error("未能更新匯入檔");
  }

  return mapImportedRowToDocument(importedDocument, data as StaffKnowledgeNoteRow);
}

export async function deleteStaffKnowledgeNote(noteId: string, userId: string): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("knowledge_cards")
    .update({
      status: "archived",
      is_active: false,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", noteId)
    .contains("tags", [STAFF_KNOWLEDGE_NOTE_TAG]);

  if (error) {
    console.error("[staff-knowledge] delete note failed:", error.message);
    throw new Error("未能刪除 Note");
  }
}

export async function deleteImportedStaffKnowledgeDocument(
  documentId: string,
  userId: string,
): Promise<void> {
  const importedDocument = await getImportedStaffKnowledgeDocument(documentId);
  const supabase = createServiceClient();
  const sourceHash = buildImportedDocumentSourceHash(documentId);
  const importedTag = `${STAFF_IMPORTED_DOCUMENT_TAG_PREFIX}${documentId}`.slice(0, 80);

  const { data: existing, error: existingError } = await supabase
    .from("knowledge_cards")
    .select("id, tags")
    .eq("source_hash", sourceHash)
    .contains("tags", [STAFF_KNOWLEDGE_NOTE_TAG])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    console.error("[staff-knowledge] fetch imported document before delete failed:", existingError.message);
    throw new Error("未能讀取匯入檔");
  }

  if (existing) {
    const { error } = await supabase
      .from("knowledge_cards")
      .update({
        title: importedDocument.title,
        body_md: importedDocument.contentMd,
        status: "archived",
        source: "manual",
        tags: buildNoteTags(
          importedDocument.category,
          importedDocument.sensitivity,
          Array.isArray(existing.tags) ? existing.tags : [],
          [importedTag],
        ),
        source_hash: sourceHash,
        is_active: true,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);

    if (error) {
      console.error("[staff-knowledge] delete imported document failed:", error.message);
      throw new Error("未能刪除匯入檔");
    }
    return;
  }

  const { error } = await supabase
    .from("knowledge_cards")
    .insert({
      title: importedDocument.title,
      body_md: importedDocument.contentMd,
      status: "archived",
      source: "manual",
      tags: buildNoteTags(importedDocument.category, importedDocument.sensitivity, [], [importedTag]),
      source_hash: sourceHash,
      sort_order: 0,
      is_active: true,
      created_by: userId,
      updated_by: userId,
    });

  if (error) {
    console.error("[staff-knowledge] create imported document delete marker failed:", error.message);
    throw new Error("未能刪除匯入檔");
  }
}

export function isVisibleStaffHandbookDocument(document: StaffKnowledgeDocument): boolean {
  void document;
  return true;
}

export async function searchStaffKnowledge(
  query: string,
  options: { includePlaceholders?: boolean; limit?: number } = {},
): Promise<StaffKnowledgeSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const terms = buildSearchTerms(trimmed);
  const documents = (await listStaffKnowledgeDocuments()).filter(isVisibleStaffHandbookDocument);

  return documents
    .filter((document) => options.includePlaceholders || document.status !== "placeholder")
    .map((document) => {
      const titleScore = scoreText(
        [document.title, document.category, document.tags.join(" ")].join("\n"),
        terms,
        trimmed,
      );
      const bodyScore = scoreText(
        [document.excerpt, document.contentMd].join("\n"),
        terms,
        trimmed,
      );
      return {
        document,
        score: Math.round((titleScore * 3 + bodyScore) * documentSearchWeight(document.id)),
        snippets: pickSnippets(document, terms, trimmed),
      };
    })
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, options.limit ?? 6);
}

function wantsPatientReply(query: string): boolean {
  const normalized = normalizeText(query);
  return (
    normalized.includes("覆") ||
    normalized.includes("回覆") ||
    normalized.includes("whatsapp") ||
    normalized.includes("病人") ||
    normalized.includes("客戶")
  );
}

function wantsCredentialLookup(query: string): boolean {
  const normalized = normalizeText(query);
  return (
    normalized.includes("密碼") ||
    normalized.includes("password") ||
    normalized.includes("登入") ||
    normalized.includes("帳號") ||
    normalized.includes("賬號") ||
    normalized.includes("戶口")
  );
}

function hasCredentialDetails(document: StaffKnowledgeDocument): boolean {
  return (
    /(密碼|password)\s*[:：]/i.test(document.contentMd) ||
    /(帳號|賬號|account)\s*[:：]/i.test(document.contentMd) ||
    /密碼\s+[0-9a-z!_]/i.test(document.contentMd) ||
    /\|\s*[^|\n]*(密碼|password)[^|\n]*\|/i.test(document.contentMd)
  );
}

function buildAnswerSection(
  result: StaffKnowledgeSearchResult,
  query: string,
): string[] {
  const snippets = result.snippets.length > 0 ? [...result.snippets] : [result.document.excerpt];

  if (wantsPatientReply(query) && result.document.patientReplyMd) {
    return [
      `根據《${result.document.title}》，可先用以下病人回覆：`,
      result.document.patientReplyMd.trim(),
      "內部提醒：",
      ...snippets.slice(0, 1).map((snippet) => `- ${snippet}`),
    ];
  }

  return [
    `根據《${result.document.title}》：`,
    ...snippets.slice(0, 2).map((snippet) => `- ${snippet}`),
  ];
}

export async function answerStaffKnowledgeQuestion(query: string): Promise<StaffKnowledgeChatAnswer> {
  const trimmed = query.trim();
  if (!trimmed) {
    return {
      answer: "請輸入想查詢的內容，例如「上門出診點覆病人？」或「講座查詢要收集咩資料？」",
      confidence: "low",
      sources: [],
    };
  }

  const results = await searchStaffKnowledge(trimmed, {
    includePlaceholders: true,
    limit: 4,
  });

  let specificResults = results.filter((item) => {
    return item.document.id !== "00-intake-index" && item.document.id !== "security-and-credentials";
  });

  if (wantsCredentialLookup(trimmed)) {
    const credentialResults = specificResults.filter((item) => hasCredentialDetails(item.document));
    if (credentialResults.length > 0) {
      specificResults = credentialResults;
    }
  }
  const usableResults = (specificResults.length > 0 ? specificResults : results).filter((item) => item.score >= 6);
  if (usableResults.length === 0) {
    return {
      answer: "手冊暫時未有足夠記錄回答呢個問題。請先轉交主管或指定同事確認，之後再把確認內容加回知識庫。",
      confidence: "low",
      sources: [],
    };
  }

  const topScore = usableResults[0]?.score ?? 0;
  const relatedThreshold = Math.max(6, topScore * 0.85);
  const topResults = usableResults
    .filter((result) => result.score >= relatedThreshold)
    .slice(0, 2);
  const answerLines = topResults.flatMap((result) => {
    return buildAnswerSection(result, trimmed);
  });

  const hasPlaceholder = topResults.some((result) => result.document.status === "placeholder");
  const answer = [
    ...answerLines,
    hasPlaceholder
      ? "以上內容仍有 placeholder 或待補部分，回覆病人前請先由主管確認。"
      : "回覆病人前仍要按最新收費、醫師安排及現場情況覆核。",
  ].join("\n");

  return {
    answer,
    confidence: topResults[0]?.score >= 18 && !hasPlaceholder ? "high" : "medium",
    sources: topResults.map((result) => ({
      id: result.document.id,
      title: result.document.title,
      category: result.document.category,
      snippets: result.snippets.length > 0 ? result.snippets : [result.document.excerpt],
    })),
  };
}
