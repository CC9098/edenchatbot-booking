import fs from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type Nullable<T> = T | null;

interface ArticleRow {
  id: string;
  slug: string;
  title: string;
  excerpt: Nullable<string>;
  content_md: string;
  cover_image_url: Nullable<string>;
  tags: string[] | null;
  is_active: boolean;
  published_at: Nullable<string>;
}

interface CourseRow {
  id: string;
  slug: string;
  title: string;
  description_md: Nullable<string>;
  cover_image_url: Nullable<string>;
  level: Nullable<string>;
  is_active: boolean;
  published_at: Nullable<string>;
}

interface ModuleRow {
  id: string;
  course_id: string;
  title: string;
  sort_order: number;
  is_active: boolean;
}

interface LessonRow {
  id: string;
  course_id: string;
  module_id: Nullable<string>;
  slug: string;
  title: string;
  content_md: string;
  video_url: Nullable<string>;
  duration_minutes: Nullable<number>;
  sort_order: number;
  is_active: boolean;
  published_at: Nullable<string>;
}

interface MigrationOptions {
  apply: boolean;
  sourceUrl: string;
  sourceKey: string;
  targetUrl: string;
  targetKey: string;
}

interface DiffCounter {
  inserted: number;
  updated: number;
  skipped: number;
}

const DEFAULT_LEGACY_ENV = "../AI電馭寫作2026/educational-platform/.env.local";

function parseEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) return {};

  const out: Record<string, string> = {};
  const lines = fs.readFileSync(filePath, "utf8").split("\n");

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx < 1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    out[key] = value;
  }

  return out;
}

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const result: Record<string, string | boolean> = {};

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--apply") {
      result.apply = true;
      continue;
    }
    if (arg === "--dry-run") {
      result.apply = false;
      continue;
    }
    if (arg.startsWith("--") && arg.includes("=")) {
      const [key, value] = arg.split("=", 2);
      result[key.slice(2)] = value;
      continue;
    }
    if (arg.startsWith("--") && i + 1 < argv.length && !argv[i + 1].startsWith("--")) {
      result[arg.slice(2)] = argv[i + 1];
      i += 1;
    }
  }

  return result;
}

function resolveOptions(): MigrationOptions {
  const args = parseArgs(process.argv.slice(2));
  const legacyEnvPathRaw = (args["legacy-env"] as string | undefined) || DEFAULT_LEGACY_ENV;
  const legacyEnvPath = path.resolve(process.cwd(), legacyEnvPathRaw);
  const legacyEnv = parseEnvFile(legacyEnvPath);

  const sourceUrl =
    (args["source-url"] as string | undefined) ||
    process.env.LEGACY_SUPABASE_URL ||
    legacyEnv.SUPABASE_URL ||
    "";
  const sourceKey =
    (args["source-key"] as string | undefined) ||
    process.env.LEGACY_SUPABASE_SERVICE_ROLE_KEY ||
    legacyEnv.SUPABASE_SERVICE_ROLE_KEY ||
    "";
  const targetUrl =
    (args["target-url"] as string | undefined) || process.env.SUPABASE_URL || "";
  const targetKey =
    (args["target-key"] as string | undefined) || process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  const apply = args.apply === true;

  if (!sourceUrl || !sourceKey) {
    throw new Error(
      "Missing source Supabase credentials. Provide --source-url/--source-key or set LEGACY_SUPABASE_* env vars."
    );
  }
  if (!targetUrl || !targetKey) {
    throw new Error(
      "Missing target Supabase credentials. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  return { apply, sourceUrl, sourceKey, targetUrl, targetKey };
}

function createServiceClient(url: string, key: string): SupabaseClient {
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function keyModule(courseId: string, title: string, sortOrder: number): string {
  return `${courseId}::${title}::${sortOrder}`;
}

function arraysEqual(left: string[] | null, right: string[] | null): boolean {
  const l = (left ?? []).slice();
  const r = (right ?? []).slice();
  if (l.length !== r.length) return false;
  for (let i = 0; i < l.length; i += 1) {
    if (l[i] !== r[i]) return false;
  }
  return true;
}

function articleChanged(source: ArticleRow, target: ArticleRow): boolean {
  return !(
    source.title === target.title &&
    source.excerpt === target.excerpt &&
    source.content_md === target.content_md &&
    source.cover_image_url === target.cover_image_url &&
    arraysEqual(source.tags, target.tags) &&
    source.is_active === target.is_active &&
    (source.published_at || null) === (target.published_at || null)
  );
}

function courseChanged(source: CourseRow, target: CourseRow): boolean {
  return !(
    source.title === target.title &&
    source.description_md === target.description_md &&
    source.cover_image_url === target.cover_image_url &&
    source.level === target.level &&
    source.is_active === target.is_active &&
    (source.published_at || null) === (target.published_at || null)
  );
}

function moduleChanged(source: ModuleRow, target: ModuleRow): boolean {
  return !(
    source.title === target.title &&
    source.sort_order === target.sort_order &&
    source.is_active === target.is_active
  );
}

function lessonChanged(source: LessonRow, target: LessonRow): boolean {
  return !(
    source.title === target.title &&
    source.content_md === target.content_md &&
    source.video_url === target.video_url &&
    source.duration_minutes === target.duration_minutes &&
    source.sort_order === target.sort_order &&
    source.is_active === target.is_active &&
    (source.published_at || null) === (target.published_at || null) &&
    (source.module_id || null) === (target.module_id || null)
  );
}

async function fetchSourceData(client: SupabaseClient) {
  const [articlesRes, coursesRes, modulesRes, lessonsRes] = await Promise.all([
    client
      .from("articles")
      .select("id, slug, title, excerpt, content_md, cover_image_url, tags, is_active, published_at")
      .order("created_at", { ascending: true }),
    client
      .from("courses")
      .select("id, slug, title, description_md, cover_image_url, level, is_active, published_at")
      .order("created_at", { ascending: true }),
    client
      .from("course_modules")
      .select("id, course_id, title, sort_order, is_active")
      .order("course_id", { ascending: true })
      .order("sort_order", { ascending: true }),
    client
      .from("course_lessons")
      .select(
        "id, course_id, module_id, slug, title, content_md, video_url, duration_minutes, sort_order, is_active, published_at"
      )
      .order("course_id", { ascending: true })
      .order("sort_order", { ascending: true }),
  ]);

  if (articlesRes.error) throw new Error(`Source articles fetch failed: ${articlesRes.error.message}`);
  if (coursesRes.error) throw new Error(`Source courses fetch failed: ${coursesRes.error.message}`);
  if (modulesRes.error) throw new Error(`Source modules fetch failed: ${modulesRes.error.message}`);
  if (lessonsRes.error) throw new Error(`Source lessons fetch failed: ${lessonsRes.error.message}`);

  return {
    articles: (articlesRes.data || []) as ArticleRow[],
    courses: (coursesRes.data || []) as CourseRow[],
    modules: (modulesRes.data || []) as ModuleRow[],
    lessons: (lessonsRes.data || []) as LessonRow[],
  };
}

async function syncArticles(params: {
  sourceRows: ArticleRow[];
  targetClient: SupabaseClient;
  apply: boolean;
}): Promise<DiffCounter> {
  const { sourceRows, targetClient, apply } = params;
  const summary: DiffCounter = { inserted: 0, updated: 0, skipped: 0 };

  const { data: targetRows, error } = await targetClient
    .from("articles")
    .select("id, slug, title, excerpt, content_md, cover_image_url, tags, is_active, published_at");
  if (error) throw new Error(`Target articles fetch failed: ${error.message}`);

  const targetBySlug = new Map((targetRows || []).map((row) => [row.slug, row as ArticleRow]));

  for (const source of sourceRows) {
    const target = targetBySlug.get(source.slug);
    const payload = {
      slug: source.slug,
      title: source.title,
      excerpt: source.excerpt,
      content_md: source.content_md,
      cover_image_url: source.cover_image_url,
      tags: source.tags ?? [],
      is_active: source.is_active,
      published_at: source.published_at,
    };

    if (!target) {
      summary.inserted += 1;
      if (apply) {
        const { error: insertError } = await targetClient.from("articles").insert(payload);
        if (insertError) throw new Error(`Insert article "${source.slug}" failed: ${insertError.message}`);
      }
      continue;
    }

    if (articleChanged(source, target)) {
      summary.updated += 1;
      if (apply) {
        const { error: updateError } = await targetClient
          .from("articles")
          .update(payload)
          .eq("slug", source.slug);
        if (updateError) throw new Error(`Update article "${source.slug}" failed: ${updateError.message}`);
      }
      continue;
    }

    summary.skipped += 1;
  }

  return summary;
}

async function syncCourses(params: {
  sourceRows: CourseRow[];
  targetClient: SupabaseClient;
  apply: boolean;
}): Promise<DiffCounter> {
  const { sourceRows, targetClient, apply } = params;
  const summary: DiffCounter = { inserted: 0, updated: 0, skipped: 0 };

  const { data: targetRows, error } = await targetClient
    .from("courses")
    .select("id, slug, title, description_md, cover_image_url, level, is_active, published_at");
  if (error) throw new Error(`Target courses fetch failed: ${error.message}`);

  const targetBySlug = new Map((targetRows || []).map((row) => [row.slug, row as CourseRow]));

  for (const source of sourceRows) {
    const target = targetBySlug.get(source.slug);
    const payload = {
      slug: source.slug,
      title: source.title,
      description_md: source.description_md,
      cover_image_url: source.cover_image_url,
      level: source.level,
      is_active: source.is_active,
      published_at: source.published_at,
    };

    if (!target) {
      summary.inserted += 1;
      if (apply) {
        const { error: insertError } = await targetClient.from("courses").insert(payload);
        if (insertError) throw new Error(`Insert course "${source.slug}" failed: ${insertError.message}`);
      }
      continue;
    }

    if (courseChanged(source, target)) {
      summary.updated += 1;
      if (apply) {
        const { error: updateError } = await targetClient
          .from("courses")
          .update(payload)
          .eq("slug", source.slug);
        if (updateError) throw new Error(`Update course "${source.slug}" failed: ${updateError.message}`);
      }
      continue;
    }

    summary.skipped += 1;
  }

  return summary;
}

async function buildCourseIdMap(
  sourceClient: SupabaseClient,
  targetClient: SupabaseClient
): Promise<Map<string, string>> {
  const [sourceRowsRes, targetRowsRes] = await Promise.all([
    sourceClient.from("courses").select("id, slug"),
    targetClient.from("courses").select("id, slug"),
  ]);

  if (sourceRowsRes.error) throw new Error(`Source courses map fetch failed: ${sourceRowsRes.error.message}`);
  if (targetRowsRes.error) throw new Error(`Target courses map fetch failed: ${targetRowsRes.error.message}`);

  const targetBySlug = new Map((targetRowsRes.data || []).map((row) => [row.slug, row.id as string]));
  const map = new Map<string, string>();

  for (const source of sourceRowsRes.data || []) {
    const targetId = targetBySlug.get(source.slug);
    if (!targetId) continue;
    map.set(source.id as string, targetId);
  }
  return map;
}

async function syncModules(params: {
  sourceRows: ModuleRow[];
  targetClient: SupabaseClient;
  sourceCourseToTargetCourse: Map<string, string>;
  apply: boolean;
}): Promise<{ summary: DiffCounter; sourceModuleToTargetModule: Map<string, string> }> {
  const { sourceRows, targetClient, sourceCourseToTargetCourse, apply } = params;
  const summary: DiffCounter = { inserted: 0, updated: 0, skipped: 0 };

  const { data: targetRows, error } = await targetClient
    .from("course_modules")
    .select("id, course_id, title, sort_order, is_active");
  if (error) throw new Error(`Target modules fetch failed: ${error.message}`);

  const targetByKey = new Map(
    (targetRows || []).map((row) => [keyModule(row.course_id as string, row.title as string, row.sort_order as number), row as ModuleRow])
  );

  const sourceModuleToTargetModule = new Map<string, string>();

  for (const source of sourceRows) {
    const targetCourseId = sourceCourseToTargetCourse.get(source.course_id);
    if (!targetCourseId) {
      throw new Error(`Cannot map source module "${source.id}" course_id "${source.course_id}" to target course.`);
    }

    const moduleKey = keyModule(targetCourseId, source.title, source.sort_order);
    const existingByKey = targetByKey.get(moduleKey);
    const payload = {
      course_id: targetCourseId,
      title: source.title,
      sort_order: source.sort_order,
      is_active: source.is_active,
    };

    if (!existingByKey) {
      summary.inserted += 1;
      if (apply) {
        const { data: inserted, error: insertError } = await targetClient
          .from("course_modules")
          .insert(payload)
          .select("id, course_id, title, sort_order, is_active")
          .single();
        if (insertError) throw new Error(`Insert module "${source.title}" failed: ${insertError.message}`);
        sourceModuleToTargetModule.set(source.id, inserted.id as string);
        targetByKey.set(moduleKey, inserted as ModuleRow);
      }
      continue;
    }

    sourceModuleToTargetModule.set(source.id, existingByKey.id);

    if (moduleChanged(source, existingByKey)) {
      summary.updated += 1;
      if (apply) {
        const { error: updateError } = await targetClient
          .from("course_modules")
          .update(payload)
          .eq("id", existingByKey.id);
        if (updateError) throw new Error(`Update module "${source.title}" failed: ${updateError.message}`);
      }
      continue;
    }

    summary.skipped += 1;
  }

  if (!apply) {
    // For dry-run, still try to map based on key to support downstream lesson planning.
    for (const source of sourceRows) {
      if (sourceModuleToTargetModule.has(source.id)) continue;
      const targetCourseId = sourceCourseToTargetCourse.get(source.course_id);
      if (!targetCourseId) continue;
      const existing = targetByKey.get(keyModule(targetCourseId, source.title, source.sort_order));
      if (existing) sourceModuleToTargetModule.set(source.id, existing.id);
    }
  }

  return { summary, sourceModuleToTargetModule };
}

async function syncLessons(params: {
  sourceRows: LessonRow[];
  targetClient: SupabaseClient;
  sourceCourseToTargetCourse: Map<string, string>;
  sourceModuleToTargetModule: Map<string, string>;
  apply: boolean;
}): Promise<DiffCounter> {
  const { sourceRows, targetClient, sourceCourseToTargetCourse, sourceModuleToTargetModule, apply } = params;
  const summary: DiffCounter = { inserted: 0, updated: 0, skipped: 0 };

  const { data: targetRows, error } = await targetClient
    .from("course_lessons")
    .select(
      "id, course_id, module_id, slug, title, content_md, video_url, duration_minutes, sort_order, is_active, published_at"
    );
  if (error) throw new Error(`Target lessons fetch failed: ${error.message}`);

  const targetByCourseAndSlug = new Map<string, LessonRow>();
  for (const row of targetRows || []) {
    targetByCourseAndSlug.set(`${row.course_id}::${row.slug}`, row as LessonRow);
  }

  for (const source of sourceRows) {
    const targetCourseId = sourceCourseToTargetCourse.get(source.course_id);
    if (!targetCourseId) {
      throw new Error(`Cannot map source lesson "${source.slug}" course_id "${source.course_id}" to target course.`);
    }

    const targetModuleId = source.module_id ? sourceModuleToTargetModule.get(source.module_id) || null : null;
    const key = `${targetCourseId}::${source.slug}`;
    const target = targetByCourseAndSlug.get(key);
    const mappedSource: LessonRow = {
      ...source,
      course_id: targetCourseId,
      module_id: targetModuleId,
    };
    const payload = {
      course_id: targetCourseId,
      module_id: targetModuleId,
      slug: source.slug,
      title: source.title,
      content_md: source.content_md,
      video_url: source.video_url,
      duration_minutes: source.duration_minutes,
      sort_order: source.sort_order,
      is_active: source.is_active,
      published_at: source.published_at,
    };

    if (!target) {
      summary.inserted += 1;
      if (apply) {
        const { error: insertError } = await targetClient.from("course_lessons").insert(payload);
        if (insertError) throw new Error(`Insert lesson "${source.slug}" failed: ${insertError.message}`);
      }
      continue;
    }

    if (lessonChanged(mappedSource, target)) {
      summary.updated += 1;
      if (apply) {
        const { error: updateError } = await targetClient
          .from("course_lessons")
          .update(payload)
          .eq("id", target.id);
        if (updateError) throw new Error(`Update lesson "${source.slug}" failed: ${updateError.message}`);
      }
      continue;
    }

    summary.skipped += 1;
  }

  return summary;
}

function printSummary(label: string, summary: DiffCounter) {
  console.log(
    `${label}: inserted=${summary.inserted}, updated=${summary.updated}, skipped=${summary.skipped}`
  );
}

async function main() {
  const options = resolveOptions();
  const modeLabel = options.apply ? "APPLY" : "DRY-RUN";
  console.log(`[legacy-content-migrate] mode=${modeLabel}`);

  const sourceClient = createServiceClient(options.sourceUrl, options.sourceKey);
  const targetClient = createServiceClient(options.targetUrl, options.targetKey);

  const sourceData = await fetchSourceData(sourceClient);
  console.log(
    `[legacy-content-migrate] source rows => articles=${sourceData.articles.length}, courses=${sourceData.courses.length}, modules=${sourceData.modules.length}, lessons=${sourceData.lessons.length}`
  );

  const articleSummary = await syncArticles({
    sourceRows: sourceData.articles,
    targetClient,
    apply: options.apply,
  });

  const courseSummary = await syncCourses({
    sourceRows: sourceData.courses,
    targetClient,
    apply: options.apply,
  });

  const courseIdMap = await buildCourseIdMap(sourceClient, targetClient);
  const { summary: moduleSummary, sourceModuleToTargetModule } = await syncModules({
    sourceRows: sourceData.modules,
    targetClient,
    sourceCourseToTargetCourse: courseIdMap,
    apply: options.apply,
  });

  const lessonSummary = await syncLessons({
    sourceRows: sourceData.lessons,
    targetClient,
    sourceCourseToTargetCourse: courseIdMap,
    sourceModuleToTargetModule,
    apply: options.apply,
  });

  printSummary("articles", articleSummary);
  printSummary("courses", courseSummary);
  printSummary("course_modules", moduleSummary);
  printSummary("course_lessons", lessonSummary);

  const totalChanges =
    articleSummary.inserted +
    articleSummary.updated +
    courseSummary.inserted +
    courseSummary.updated +
    moduleSummary.inserted +
    moduleSummary.updated +
    lessonSummary.inserted +
    lessonSummary.updated;

  if (!options.apply) {
    console.log(`[legacy-content-migrate] dry-run complete. pending changes=${totalChanges}`);
    console.log("[legacy-content-migrate] re-run with --apply to execute migration.");
  } else {
    console.log(`[legacy-content-migrate] apply complete. total changes=${totalChanges}`);
  }
}

main().catch((error) => {
  console.error("[legacy-content-migrate] failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
