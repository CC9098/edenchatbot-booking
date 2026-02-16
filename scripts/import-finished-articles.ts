import fs from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

interface ImportedArticle {
  slug: string;
  title: string;
  excerpt: string | null;
  contentMd: string;
  tags: string[];
  publishedAt: string;
  isActive: boolean;
  sourceFile: string;
}

interface FrontmatterResult {
  metadata: Record<string, string>;
  body: string;
}

const DEFAULT_ARTICLE_DIR = "../AI電馭寫作2026/三型體質文稿/完成文章";
const DEFAULT_EXTENSIONS = [".md", ".mdx"];

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--apply") {
      out.apply = true;
      continue;
    }
    if (arg === "--dry-run") {
      out.apply = false;
      continue;
    }
    if (arg.startsWith("--") && arg.includes("=")) {
      const [key, value] = arg.split("=", 2);
      out[key.slice(2)] = value;
      continue;
    }
    if (arg.startsWith("--") && i + 1 < argv.length && !argv[i + 1].startsWith("--")) {
      out[arg.slice(2)] = argv[i + 1];
      i += 1;
      continue;
    }
  }
  return out;
}

function parseFrontmatter(input: string): FrontmatterResult {
  if (!input.startsWith("---\n")) {
    return { metadata: {}, body: input };
  }

  const end = input.indexOf("\n---\n", 4);
  if (end < 0) {
    return { metadata: {}, body: input };
  }

  const block = input.slice(4, end);
  const body = input.slice(end + 5);
  const metadata: Record<string, string> = {};

  for (const line of block.split("\n")) {
    const idx = line.indexOf(":");
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (!key || !value) continue;
    metadata[key] = value;
  }

  return { metadata, body };
}

function normalizeSlug(input: string): string {
  return input
    .normalize("NFKC")
    .replace(/[_.]/g, "-")
    .replace(/[？?]/g, "")
    .replace(/(完成文章|草稿)/g, "")
    .replace(/[^\p{L}\p{N}-]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function deriveTitle(baseName: string, body: string, metadata: Record<string, string>): string {
  if (metadata.title) return metadata.title;

  for (const line of body.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("# ")) {
      return trimmed.slice(2).trim();
    }
  }

  return baseName
    .replace(/\.[^.]+$/g, "")
    .replace(/[_-](完成文章|草稿)$/g, "")
    .replace(/[_-]+/g, " ")
    .trim();
}

function deriveExcerpt(body: string, metadata: Record<string, string>): string | null {
  if (metadata.excerpt) return metadata.excerpt.slice(0, 180);
  const lines = body
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith("#"));

  const paragraph = lines.find((line) => line.length >= 18) || lines[0];
  if (!paragraph) return null;
  return paragraph.slice(0, 180);
}

function parseTagsFromMetadata(metadata: Record<string, string>): string[] {
  const raw = metadata.tags || metadata.tag || "";
  if (!raw) return [];

  const normalized = raw
    .replace(/^\[/, "")
    .replace(/\]$/, "")
    .split(/[,\|、]/g)
    .map((part) => part.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);

  return Array.from(new Set(normalized)).slice(0, 8);
}

function inferTags(text: string): string[] {
  const rules: Array<{ pattern: RegExp; tag: string }> = [
    { pattern: /交錯|火鬱|胸悶|鬱/u, tag: "交錯型" },
    { pattern: /虛耗|失眠|焦慮|枯乾|崩塌/u, tag: "虛耗型" },
    { pattern: /祛濕|濕重|痰濕|屯積|累積/u, tag: "屯積型" },
    { pattern: /肩頸|頭痛|背痛|痛法/u, tag: "疼痛調理" },
    { pattern: /中醫|體質|養生/u, tag: "中醫體質" },
  ];

  const tags: string[] = [];
  for (const rule of rules) {
    if (rule.pattern.test(text)) {
      tags.push(rule.tag);
    }
  }
  return Array.from(new Set(tags)).slice(0, 8);
}

function listArticleFiles(dirPath: string, includeDrafts: boolean): string[] {
  const files = fs.readdirSync(dirPath);
  return files
    .filter((file) => DEFAULT_EXTENSIONS.includes(path.extname(file).toLowerCase()))
    .filter((file) => (includeDrafts ? true : !file.includes("草稿")))
    .map((file) => path.join(dirPath, file))
    .sort((a, b) => a.localeCompare(b, "zh-Hant"));
}

function parseDate(value: string): string | null {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function sanitizeTags(tags: string[]): string[] {
  return Array.from(
    new Set(
      tags
        .map((tag) => tag.trim())
        .filter(Boolean)
        .map((tag) => tag.slice(0, 40))
    )
  ).slice(0, 10);
}

function mergeTags(existing: string[] | null, incoming: string[]): string[] {
  return sanitizeTags([...(existing || []), ...incoming]);
}

function loadArticlesFromDirectory(articleDir: string, includeDrafts: boolean): ImportedArticle[] {
  const files = listArticleFiles(articleDir, includeDrafts);
  const rows: ImportedArticle[] = [];

  for (const fullPath of files) {
    const source = fs.readFileSync(fullPath, "utf8");
    const stat = fs.statSync(fullPath);
    const baseName = path.basename(fullPath);
    const { metadata, body } = parseFrontmatter(source);
    const title = deriveTitle(baseName, body, metadata);
    const slug = normalizeSlug(metadata.slug || baseName.replace(/\.[^.]+$/g, ""));
    const excerpt = deriveExcerpt(body, metadata);
    const publishedAt =
      parseDate(metadata.published_at || metadata.date || metadata.publishedat || "") ||
      stat.mtime.toISOString();

    const metadataTags = parseTagsFromMetadata(metadata);
    const inferred = inferTags(`${title}\n${body}\n${baseName}`);
    const tags = sanitizeTags([...metadataTags, ...inferred]);

    rows.push({
      slug,
      title,
      excerpt,
      contentMd: body.trim() + "\n",
      tags,
      publishedAt,
      isActive: true,
      sourceFile: fullPath,
    });
  }

  return rows;
}

function createServiceClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function articleDiffers(
  target: {
    title: string;
    excerpt: string | null;
    content_md: string;
    tags: string[] | null;
    is_active: boolean;
    published_at: string | null;
  },
  incoming: ImportedArticle,
  mergedTags: string[]
): boolean {
  return !(
    target.title === incoming.title &&
    (target.excerpt || null) === (incoming.excerpt || null) &&
    target.content_md === incoming.contentMd &&
    JSON.stringify(target.tags || []) === JSON.stringify(mergedTags) &&
    target.is_active === incoming.isActive &&
    (target.published_at || null) === (incoming.publishedAt || null)
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const apply = args.apply === true;
  const includeDrafts = args["include-drafts"] === true;
  const articleDir = path.resolve(
    process.cwd(),
    (args["article-dir"] as string | undefined) || DEFAULT_ARTICLE_DIR
  );

  if (!fs.existsSync(articleDir) || !fs.statSync(articleDir).isDirectory()) {
    throw new Error(`Article directory not found: ${articleDir}`);
  }

  const client = createServiceClient();
  const sourceArticles = loadArticlesFromDirectory(articleDir, includeDrafts);

  console.log(`[import-finished-articles] mode=${apply ? "APPLY" : "DRY-RUN"}`);
  console.log(`[import-finished-articles] articleDir=${articleDir}`);
  console.log(`[import-finished-articles] files=${sourceArticles.length}`);

  const { data: targetRows, error: fetchError } = await client
    .from("articles")
    .select("id, slug, title, excerpt, content_md, tags, is_active, published_at");
  if (fetchError) {
    throw new Error(`Failed to fetch target articles: ${fetchError.message}`);
  }

  const targetBySlug = new Map((targetRows || []).map((row) => [row.slug as string, row]));
  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of sourceArticles) {
    const existing = targetBySlug.get(row.slug);
    const mergedTags = mergeTags((existing?.tags as string[] | null | undefined) || null, row.tags);
    const payload = {
      slug: row.slug,
      title: row.title,
      excerpt: row.excerpt,
      content_md: row.contentMd,
      tags: mergedTags,
      is_active: row.isActive,
      published_at: row.publishedAt,
    };

    if (!existing) {
      inserted += 1;
      console.log(`[insert] ${row.slug} <- ${path.basename(row.sourceFile)}`);
      if (apply) {
        const { error } = await client.from("articles").insert(payload);
        if (error) throw new Error(`Insert failed for ${row.slug}: ${error.message}`);
      }
      continue;
    }

    if (!articleDiffers(existing as never, row, mergedTags)) {
      skipped += 1;
      continue;
    }

    updated += 1;
    console.log(`[update] ${row.slug} <- ${path.basename(row.sourceFile)}`);
    if (apply) {
      const { error } = await client.from("articles").update(payload).eq("slug", row.slug);
      if (error) throw new Error(`Update failed for ${row.slug}: ${error.message}`);
    }
  }

  console.log(
    `[import-finished-articles] summary inserted=${inserted}, updated=${updated}, skipped=${skipped}`
  );
  if (!apply) {
    console.log("[import-finished-articles] re-run with --apply to write changes.");
  }
}

main().catch((error) => {
  console.error(
    "[import-finished-articles] failed:",
    error instanceof Error ? error.message : error
  );
  process.exit(1);
});
