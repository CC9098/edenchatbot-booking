import crypto from "node:crypto";

export const KNOWLEDGE_CARD_STATUSES = [
  "inbox",
  "drafting",
  "ready",
  "published",
  "archived",
] as const;

export const KNOWLEDGE_CARD_SOURCES = ["manual", "article_sync", "ai_assist"] as const;

export type KnowledgeCardStatus = (typeof KNOWLEDGE_CARD_STATUSES)[number];
export type KnowledgeCardSource = (typeof KNOWLEDGE_CARD_SOURCES)[number];

export interface KnowledgeCardRow {
  id: string;
  title: string;
  body_md: string;
  status: KnowledgeCardStatus;
  source: KnowledgeCardSource;
  tags: string[] | null;
  source_article_id: string | null;
  source_hash: string | null;
  sort_order: number;
  is_active: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeCardArticleLinkRow {
  id: string;
  card_id: string;
  article_id: string;
  relation_type: "seed" | "draft" | "published";
  created_by: string | null;
  created_at: string;
}

export function isKnowledgeCardStatus(value: unknown): value is KnowledgeCardStatus {
  return typeof value === "string" && KNOWLEDGE_CARD_STATUSES.includes(value as KnowledgeCardStatus);
}

export function isKnowledgeCardSource(value: unknown): value is KnowledgeCardSource {
  return typeof value === "string" && KNOWLEDGE_CARD_SOURCES.includes(value as KnowledgeCardSource);
}

export function parseKnowledgeCardStatus(
  value: unknown,
  fallback: KnowledgeCardStatus = "inbox"
): KnowledgeCardStatus {
  if (isKnowledgeCardStatus(value)) return value;
  return fallback;
}

export function parseKnowledgeCardSource(
  value: unknown,
  fallback: KnowledgeCardSource = "manual"
): KnowledgeCardSource {
  if (isKnowledgeCardSource(value)) return value;
  return fallback;
}

export function sanitizeCardTags(value: unknown, maxItems = 12): string[] {
  let rawValues: string[] = [];
  if (Array.isArray(value)) {
    rawValues = value.filter((item): item is string => typeof item === "string");
  } else if (typeof value === "string") {
    rawValues = value.split(/[,\n]/g);
  }

  const deduped = new Set<string>();
  for (const raw of rawValues) {
    const cleaned = raw.trim().replace(/^#+/, "").replace(/\s+/g, " ");
    if (!cleaned) continue;
    deduped.add(cleaned.slice(0, 40));
    if (deduped.size >= maxItems) break;
  }
  return Array.from(deduped);
}

export function compactMarkdown(text: string, maxChars = 420): string {
  const normalized = text
    .replace(/\r/g, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/!\[[^\]]*]\([^)]+\)/g, "")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
    .replace(/^#+\s+/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, Math.max(1, maxChars - 1)).trimEnd()}…`;
}

export function hashCardSource(parts: Array<string | null | undefined>): string {
  const input = parts.map((part) => part ?? "").join("||");
  return crypto.createHash("sha1").update(input).digest("hex");
}

export function mapKnowledgeCardRow(row: KnowledgeCardRow) {
  return {
    id: row.id,
    title: row.title,
    bodyMd: row.body_md,
    status: row.status,
    source: row.source,
    tags: Array.isArray(row.tags) ? row.tags : [],
    sourceArticleId: row.source_article_id,
    sourceHash: row.source_hash,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
