import fs from "node:fs/promises";
import path from "node:path";

import type {
  StaffKnowledgeChatAnswer,
  StaffKnowledgeDocument,
  StaffKnowledgeSearchResult,
  StaffKnowledgeSensitivity,
  StaffKnowledgeStatus,
} from "@/lib/staff-knowledge-base-types";

const KNOWLEDGE_ROOT = path.join(process.cwd(), "docs", "staff-knowledge-base");

const CATEGORY_BY_PREFIX: Array<[string, string]> = [
  ["patient-enquiries/", "病人查詢回覆"],
  ["00-intake-index", "知識庫目錄"],
  ["security-and-credentials", "安全與權限"],
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

export async function listStaffKnowledgeDocuments(): Promise<StaffKnowledgeDocument[]> {
  const filePaths = await collectMarkdownFiles(KNOWLEDGE_ROOT);
  const documents = await Promise.all(
    filePaths.map(async (filePath) => {
      const contentMd = await fs.readFile(filePath, "utf8");
      const relativePath = path.relative(KNOWLEDGE_ROOT, filePath).replace(/\\/g, "/");
      const id = relativePath.replace(/\.md$/, "");
      const title = toTitle(contentMd, path.basename(filePath, ".md"));
      const patientReplyMd = extractSection(
        contentMd,
        /^##\s+(病人|病人\/客戶).*可見回覆/,
      );

      return {
        id,
        title,
        category: toCategory(relativePath),
        status: parseStatus(contentMd),
        sensitivity: parseSensitivity(contentMd),
        source: parseMetadataValue(contentMd, "來源") || "staff-knowledge-base",
        updatedAt: parseMetadataValue(contentMd, "最後整理") || "未標記",
        excerpt: compactMarkdown(contentMd),
        contentMd,
        patientReplyMd,
        sourcePath: `docs/staff-knowledge-base/${relativePath}`,
        tags: Array.from(new Set([toCategory(relativePath), parseStatus(contentMd), parseSensitivity(contentMd)])),
      } satisfies StaffKnowledgeDocument;
    }),
  );

  return documents.sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category, "zh-HK");
    return a.title.localeCompare(b.title, "zh-HK");
  });
}

export function isVisibleStaffHandbookDocument(document: StaffKnowledgeDocument): boolean {
  if (document.id === "00-intake-index") return false;
  if (document.id === "security-and-credentials") return false;
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
        score: titleScore * 3 + bodyScore,
        snippets: pickSnippets(document, terms, trimmed),
      };
    })
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, options.limit ?? 6);
}

function hasCredentialRequest(query: string): boolean {
  const normalized = normalizeText(query);
  return (
    normalized.includes("密碼") ||
    normalized.includes("password") ||
    normalized.includes("otp") ||
    normalized.includes("戶口號碼") ||
    normalized.includes("銀行戶口") ||
    normalized.includes("fps") ||
    normalized.includes("快速識別碼")
  );
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

  if (hasCredentialRequest(trimmed)) {
    const securityResult = results.find((item) => item.document.id === "security-and-credentials");
    const security = securityResult?.document
      || (await listStaffKnowledgeDocuments()).find((item) => item.id === "security-and-credentials");

    return {
      answer: [
        "這類資料屬 restricted。知識庫規則是不由 AI 提供密碼、OTP、銀行戶口或後台憑證。",
        "可查的是登入位置、用途、操作步驟和負責人；真正密碼應放在受控密碼管理工具或由主管確認。",
      ].join("\n\n"),
      confidence: "blocked",
      sources: security
        ? [{
            id: security.id,
            title: security.title,
            category: security.category,
            snippets: [security.excerpt],
          }]
        : [],
    };
  }

  const specificResults = results.filter((item) => item.document.id !== "00-intake-index");
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
