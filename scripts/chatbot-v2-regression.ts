import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

dotenv.config({ path: '.env.local' });
dotenv.config();

const execFileAsync = promisify(execFile);

type ChatMode = 'B' | 'G1' | 'G2' | 'G3';

type CaseMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type CaseExpect = {
  modeIn?: ChatMode[];
  modeNotIn?: ChatMode[];
  maxWords?: number;
  minWords?: number;
  requireJson?: boolean;
  mustContain?: string[];
  mustNotContain?: string[];
  disallowBookingNudge?: boolean;
};

type RegressionCase = {
  id: string;
  title: string;
  language: string;
  messages: CaseMessage[];
  expect?: CaseExpect;
};

type RegressionSuite = {
  version: string;
  description?: string;
  cases: RegressionCase[];
};

type CaseDbMetrics = {
  model_gear: string | null;
  response_gear: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  knowledge_chars: number | null;
  knowledge_injected: boolean | null;
  duration_ms: number | null;
  error: string | null;
  created_at: string | null;
  prompt_variant: string | null;
};

type CaseResult = {
  id: string;
  title: string;
  language: string;
  sessionId: string;
  ok: boolean;
  checks: Array<{ name: string; ok: boolean; detail?: string }>;
  httpStatus: number;
  apiMode: string | null;
  apiType: string | null;
  reply: string;
  clientDurationMs: number;
  dbMetrics: CaseDbMetrics | null;
};

type PerfSummary = {
  sampleCount: number;
  durationP50Ms: number | null;
  durationP90Ms: number | null;
  promptTokensP50: number | null;
  promptTokensP90: number | null;
  knowledgeCharsP50: number | null;
  knowledgeCharsP90: number | null;
};

type PerfGateResult = {
  enabled: boolean;
  checks: Array<{ name: string; ok: boolean; detail: string }>;
  ok: boolean;
};

const BOOKING_NUDGE_REGEX = /(預約|预约|book|booking|appointment|診所|时段|時段|醫師|医师|doctor|\bdr\b)/i;

function getNowStamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function toNonEmptyString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function parseWordCountCjkAware(text: string): number {
  const normalized = normalizeText(text);
  if (!normalized) return 0;

  const cjkCount = (normalized.match(/[\p{Script=Han}]/gu) || []).length;
  const latinWords = (normalized.match(/[A-Za-z0-9]+(?:'[A-Za-z0-9]+)?/g) || []).length;

  return cjkCount + latinWords;
}

function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = (sorted.length - 1) * p;
  const lower = Math.floor(rank);
  const upper = Math.ceil(rank);
  if (lower === upper) return sorted[lower];
  const weight = rank - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

function parseNumberEnv(value: string | undefined, fallback: number): number {
  const raw = Number(value);
  if (!Number.isFinite(raw) || raw <= 0) return fallback;
  return raw;
}

function tryParseJson(text: string): { ok: true; value: unknown } | { ok: false; error: string } {
  const trimmed = text.trim();
  const candidates = [trimmed];

  if (trimmed.startsWith('```')) {
    const fenced = trimmed
      .replace(/^```[a-zA-Z]*\n?/, '')
      .replace(/\n?```$/, '')
      .trim();
    candidates.push(fenced);
  }

  const objectMatches = trimmed.match(/\{[\s\S]*?\}/g) || [];
  if (objectMatches.length > 0) {
    for (let i = objectMatches.length - 1; i >= 0; i -= 1) {
      candidates.push(objectMatches[i]);
    }
  }

  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      return { ok: true, value: JSON.parse(candidate) };
    } catch {
      // try next
    }
  }

  return { ok: false, error: 'invalid_json_output' };
}

function loadSuite(casesPath: string): RegressionSuite {
  const raw = fs.readFileSync(casesPath, 'utf-8');
  const parsed = JSON.parse(raw) as RegressionSuite;

  if (!Array.isArray(parsed.cases) || parsed.cases.length === 0) {
    throw new Error('Regression case file has no cases.');
  }

  return parsed;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchDbMetricsWithRetry(
  supabase: any,
  sessionId: string,
  retries: number,
  delayMs: number,
): Promise<CaseDbMetrics | null> {
  for (let i = 0; i < retries; i += 1) {
    const { data, error } = await supabase
      .from('chat_request_logs')
      .select('model_gear,response_gear,prompt_tokens,completion_tokens,knowledge_chars,knowledge_injected,duration_ms,error,created_at,prompt_variant')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      if (i === retries - 1) {
        throw new Error(`Failed to fetch db metrics for ${sessionId}: ${error.message}`);
      }
      await sleep(delayMs);
      continue;
    }

    if (data) {
      const row = data as Record<string, unknown>;
      return {
        model_gear: typeof row.model_gear === 'string' ? row.model_gear : null,
        response_gear: typeof row.response_gear === 'string' ? row.response_gear : null,
        prompt_tokens: typeof row.prompt_tokens === 'number' ? row.prompt_tokens : null,
        completion_tokens: typeof row.completion_tokens === 'number' ? row.completion_tokens : null,
        knowledge_chars: typeof row.knowledge_chars === 'number' ? row.knowledge_chars : null,
        knowledge_injected: typeof row.knowledge_injected === 'boolean' ? row.knowledge_injected : null,
        duration_ms: typeof row.duration_ms === 'number' ? row.duration_ms : null,
        error: typeof row.error === 'string' ? row.error : null,
        created_at: typeof row.created_at === 'string' ? row.created_at : null,
        prompt_variant: typeof row.prompt_variant === 'string' ? row.prompt_variant : null,
      };
    }

    if (i < retries - 1) await sleep(delayMs);
  }

  return null;
}

type ApiCallResult = {
  status: number;
  bodyText: string;
  bodyJson: Record<string, unknown> | null;
};

async function requestViaFetch(
  endpoint: string,
  payload: Record<string, unknown>,
  timeoutMs: number,
): Promise<ApiCallResult> {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: controller.signal,
  });

  clearTimeout(timeoutHandle);
  const bodyText = await response.text();
  let bodyJson: Record<string, unknown> | null = null;
  try {
    bodyJson = JSON.parse(bodyText) as Record<string, unknown>;
  } catch {
    bodyJson = null;
  }

  return {
    status: response.status,
    bodyText,
    bodyJson,
  };
}

async function requestViaVercelCurl(
  deploymentUrl: string,
  endpointPath: string,
  payload: Record<string, unknown>,
  timeoutMs: number,
): Promise<ApiCallResult> {
  const args = [
    'curl',
    endpointPath,
    '--deployment',
    deploymentUrl,
    '--',
    '--silent',
    '--show-error',
    '--request',
    'POST',
    '--header',
    'Content-Type: application/json',
    '--data',
    JSON.stringify(payload),
    '--write-out',
    '\\n__HTTP_STATUS__:%{http_code}',
  ];

  const { stdout } = await execFileAsync('vercel', args, {
    maxBuffer: 10 * 1024 * 1024,
    timeout: timeoutMs,
  });

  const marker = '\n__HTTP_STATUS__:';
  const markerIndex = stdout.lastIndexOf(marker);
  if (markerIndex < 0) {
    return {
      status: 0,
      bodyText: stdout.trim(),
      bodyJson: null,
    };
  }

  const rawBody = stdout.slice(0, markerIndex).trim();
  const statusRaw = stdout.slice(markerIndex + marker.length).trim();
  const parsedStatus = Number(statusRaw);

  let bodyJson: Record<string, unknown> | null = null;
  try {
    bodyJson = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    const parsed = tryParseJson(rawBody);
    if (parsed.ok && parsed.value && typeof parsed.value === 'object' && !Array.isArray(parsed.value)) {
      bodyJson = parsed.value as Record<string, unknown>;
    }
  }

  return {
    status: Number.isFinite(parsedStatus) ? parsedStatus : 0,
    bodyText: rawBody,
    bodyJson,
  };
}

function buildPerfSummary(results: CaseResult[]): PerfSummary {
  const durations = results
    .map((item) => item.dbMetrics?.duration_ms)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  const prompts = results
    .map((item) => item.dbMetrics?.prompt_tokens)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  const knowledgeChars = results
    .map((item) => item.dbMetrics?.knowledge_chars)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

  return {
    sampleCount: durations.length,
    durationP50Ms: percentile(durations, 0.5),
    durationP90Ms: percentile(durations, 0.9),
    promptTokensP50: percentile(prompts, 0.5),
    promptTokensP90: percentile(prompts, 0.9),
    knowledgeCharsP50: percentile(knowledgeChars, 0.5),
    knowledgeCharsP90: percentile(knowledgeChars, 0.9),
  };
}

function evaluatePerfGates(summary: PerfSummary): PerfGateResult {
  const enabled = process.env.CHAT_REGRESSION_PERF_GATE !== 'false';
  if (!enabled) {
    return { enabled, checks: [], ok: true };
  }

  const maxP50DurationMs = parseNumberEnv(process.env.CHAT_REGRESSION_MAX_P50_DURATION_MS, 12000);
  const maxP90DurationMs = parseNumberEnv(process.env.CHAT_REGRESSION_MAX_P90_DURATION_MS, 20000);
  const maxP50PromptTokens = parseNumberEnv(process.env.CHAT_REGRESSION_MAX_P50_PROMPT_TOKENS, 9000);
  const maxP90PromptTokens = parseNumberEnv(process.env.CHAT_REGRESSION_MAX_P90_PROMPT_TOKENS, 13000);
  const maxP90KnowledgeChars = parseNumberEnv(process.env.CHAT_REGRESSION_MAX_P90_KNOWLEDGE_CHARS, 2200);

  const checks: PerfGateResult['checks'] = [];
  const pushCheck = (name: string, ok: boolean, detail: string) => checks.push({ name, ok, detail });

  if (summary.sampleCount === 0) {
    pushCheck('perf_sample_exists', false, 'No DB metrics samples collected.');
    return { enabled, checks, ok: false };
  }

  pushCheck(
    'p50_duration_ms',
    typeof summary.durationP50Ms === 'number' && summary.durationP50Ms <= maxP50DurationMs,
    `max=${maxP50DurationMs} actual=${summary.durationP50Ms ?? 'null'}`,
  );
  pushCheck(
    'p90_duration_ms',
    typeof summary.durationP90Ms === 'number' && summary.durationP90Ms <= maxP90DurationMs,
    `max=${maxP90DurationMs} actual=${summary.durationP90Ms ?? 'null'}`,
  );
  pushCheck(
    'p50_prompt_tokens',
    typeof summary.promptTokensP50 === 'number' && summary.promptTokensP50 <= maxP50PromptTokens,
    `max=${maxP50PromptTokens} actual=${summary.promptTokensP50 ?? 'null'}`,
  );
  pushCheck(
    'p90_prompt_tokens',
    typeof summary.promptTokensP90 === 'number' && summary.promptTokensP90 <= maxP90PromptTokens,
    `max=${maxP90PromptTokens} actual=${summary.promptTokensP90 ?? 'null'}`,
  );

  if (typeof summary.knowledgeCharsP90 === 'number') {
    pushCheck(
      'p90_knowledge_chars',
      summary.knowledgeCharsP90 <= maxP90KnowledgeChars,
      `max=${maxP90KnowledgeChars} actual=${summary.knowledgeCharsP90}`,
    );
  }

  return {
    enabled,
    checks,
    ok: checks.every((item) => item.ok),
  };
}

async function run(): Promise<void> {
  const baseUrl = process.env.CHAT_REGRESSION_BASE_URL || 'http://localhost:3000';
  const casesPath = process.env.CHAT_REGRESSION_CASES_PATH || 'scripts/chatbot-v2-regression-cases.json';
  const outputRoot = process.env.CHAT_REGRESSION_OUTPUT_DIR || 'output/chatbot-v2-regression';
  const interCaseDelayMs = Number(process.env.CHAT_REGRESSION_DELAY_MS || '150');
  const apiTimeoutMs = Number(process.env.CHAT_REGRESSION_TIMEOUT_MS || '90000');
  const dbRetryCount = Number(process.env.CHAT_REGRESSION_DB_RETRY_COUNT || '12');
  const dbRetryDelayMs = Number(process.env.CHAT_REGRESSION_DB_RETRY_DELAY_MS || '250');
  const useVercelCurl = process.env.CHAT_REGRESSION_USE_VERCEL_CURL === 'true';

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for regression metrics output.');
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const suite = loadSuite(casesPath);
  const runId = getNowStamp();
  const runDir = path.join(outputRoot, runId);
  fs.mkdirSync(runDir, { recursive: true });

  const results: CaseResult[] = [];

  console.log(`[regression] runId=${runId}`);
  console.log(`[regression] cases=${suite.cases.length} baseUrl=${baseUrl}`);

  for (const item of suite.cases) {
    const sessionId = `chatv2-reg-${runId}-${item.id.toLowerCase()}`;
    const endpoint = `${baseUrl.replace(/\/$/, '')}/api/chat/v2`;
    const endpointPath = '/api/chat/v2';
    const payload = {
      sessionId,
      messages: item.messages,
      stream: false,
    };

    const checks: CaseResult['checks'] = [];
    const addCheck = (name: string, ok: boolean, detail?: string) => checks.push({ name, ok, detail });

    const startedAt = Date.now();
    let httpStatus = 0;
    let apiMode: string | null = null;
    let apiType: string | null = null;
    let reply = '';

    try {
      const response = useVercelCurl
        ? await requestViaVercelCurl(baseUrl, endpointPath, payload, apiTimeoutMs)
        : await requestViaFetch(endpoint, payload, apiTimeoutMs);

      httpStatus = response.status;
      const body = response.bodyJson || {};
      apiMode = typeof body.mode === 'string' ? body.mode : null;
      apiType = typeof body.type === 'string' ? body.type : null;
      reply = toNonEmptyString(body.reply ?? body.error ?? response.bodyText);
      addCheck('http_ok', httpStatus >= 200 && httpStatus < 300, `status=${httpStatus}`);
      addCheck('reply_not_empty', reply.length > 0, `length=${reply.length}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      addCheck('request_success', false, message);
    }

    const clientDurationMs = Date.now() - startedAt;
    const dbMetrics = await fetchDbMetricsWithRetry(supabase, sessionId, dbRetryCount, dbRetryDelayMs);

    const effectiveMode = (apiMode || dbMetrics?.model_gear || null) as ChatMode | null;
    const expect = item.expect || {};

    if (expect.modeIn && expect.modeIn.length > 0) {
      addCheck(
        'mode_in',
        !!effectiveMode && expect.modeIn.includes(effectiveMode),
        `expected=${expect.modeIn.join('|')} actual=${effectiveMode ?? 'null'}`,
      );
    }

    if (expect.modeNotIn && expect.modeNotIn.length > 0) {
      addCheck(
        'mode_not_in',
        !effectiveMode || !expect.modeNotIn.includes(effectiveMode),
        `forbidden=${expect.modeNotIn.join('|')} actual=${effectiveMode ?? 'null'}`,
      );
    }

    if (expect.requireJson) {
      const jsonParsed = tryParseJson(reply);
      addCheck('valid_json_output', jsonParsed.ok, jsonParsed.ok ? undefined : jsonParsed.error);
    }

    const wordCount = parseWordCountCjkAware(reply);
    if (typeof expect.maxWords === 'number') {
      addCheck('max_words', wordCount <= expect.maxWords, `max=${expect.maxWords} actual=${wordCount}`);
    }
    if (typeof expect.minWords === 'number') {
      addCheck('min_words', wordCount >= expect.minWords, `min=${expect.minWords} actual=${wordCount}`);
    }

    for (const required of expect.mustContain || []) {
      addCheck(`must_contain:${required}`, reply.includes(required), `required=${required}`);
    }

    for (const forbidden of expect.mustNotContain || []) {
      addCheck(`must_not_contain:${forbidden}`, !reply.includes(forbidden), `forbidden=${forbidden}`);
    }

    if (expect.disallowBookingNudge) {
      addCheck('no_booking_nudge', !BOOKING_NUDGE_REGEX.test(reply), 'booking nudge detected');
    }

    const ok = checks.every((check) => check.ok);

    const result: CaseResult = {
      id: item.id,
      title: item.title,
      language: item.language,
      sessionId,
      ok,
      checks,
      httpStatus,
      apiMode,
      apiType,
      reply,
      clientDurationMs,
      dbMetrics,
    };

    results.push(result);

    const modelGear = dbMetrics?.model_gear ?? 'null';
    const responseGear = dbMetrics?.response_gear ?? 'null';
    const promptTokens = dbMetrics?.prompt_tokens ?? -1;
    const completionTokens = dbMetrics?.completion_tokens ?? -1;
    const knowledgeChars = dbMetrics?.knowledge_chars ?? -1;
    const durationMs = dbMetrics?.duration_ms ?? clientDurationMs;

    console.log(
      `[case ${item.id}] ${ok ? 'PASS' : 'FAIL'} | mode=${effectiveMode ?? 'null'} | model_gear=${modelGear} | response_gear=${responseGear} | prompt=${promptTokens} | completion=${completionTokens} | knowledge=${knowledgeChars} | duration=${durationMs}ms`
    );

    if (interCaseDelayMs > 0) {
      await sleep(interCaseDelayMs);
    }
  }

  const passed = results.filter((item) => item.ok).length;
  const failed = results.length - passed;
  const perfSummary = buildPerfSummary(results);
  const perfGate = evaluatePerfGates(perfSummary);

  const jsonPath = path.join(runDir, 'results.json');
  fs.writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        runId,
        generatedAt: new Date().toISOString(),
        baseUrl,
        suiteVersion: suite.version,
        total: results.length,
        passed,
        failed,
        perfSummary,
        perfGate,
        results,
      },
      null,
      2,
    ),
    'utf-8',
  );

  const mdLines: string[] = [];
  mdLines.push(`# Chatbot v2 Regression Report (${runId})`);
  mdLines.push('');
  mdLines.push(`- Base URL: ${baseUrl}`);
  mdLines.push(`- Suite version: ${suite.version}`);
  mdLines.push(`- Total: ${results.length}`);
  mdLines.push(`- Passed: ${passed}`);
  mdLines.push(`- Failed: ${failed}`);
  mdLines.push(`- Perf gate: ${perfGate.enabled ? (perfGate.ok ? 'PASS' : 'FAIL') : 'DISABLED'}`);
  mdLines.push('');
  mdLines.push('| Case | Result | model_gear | response_gear | prompt_tokens | completion_tokens | knowledge_chars | duration_ms |');
  mdLines.push('|---|---|---|---|---:|---:|---:|---:|');

  for (const result of results) {
    mdLines.push(
      `| ${result.id} | ${result.ok ? 'PASS' : 'FAIL'} | ${result.dbMetrics?.model_gear ?? 'null'} | ${result.dbMetrics?.response_gear ?? 'null'} | ${result.dbMetrics?.prompt_tokens ?? -1} | ${result.dbMetrics?.completion_tokens ?? -1} | ${result.dbMetrics?.knowledge_chars ?? -1} | ${result.dbMetrics?.duration_ms ?? result.clientDurationMs} |`,
    );
  }

  mdLines.push('');
  mdLines.push('## Perf Summary');
  mdLines.push('');
  mdLines.push(`- sample_count: ${perfSummary.sampleCount}`);
  mdLines.push(`- p50_duration_ms: ${perfSummary.durationP50Ms ?? 'null'}`);
  mdLines.push(`- p90_duration_ms: ${perfSummary.durationP90Ms ?? 'null'}`);
  mdLines.push(`- p50_prompt_tokens: ${perfSummary.promptTokensP50 ?? 'null'}`);
  mdLines.push(`- p90_prompt_tokens: ${perfSummary.promptTokensP90 ?? 'null'}`);
  mdLines.push(`- p50_knowledge_chars: ${perfSummary.knowledgeCharsP50 ?? 'null'}`);
  mdLines.push(`- p90_knowledge_chars: ${perfSummary.knowledgeCharsP90 ?? 'null'}`);
  mdLines.push('');
  mdLines.push('## Perf Gate Checks');
  mdLines.push('');

  if (!perfGate.enabled) {
    mdLines.push('- Perf gate disabled via `CHAT_REGRESSION_PERF_GATE=false`');
  } else if (perfGate.checks.length === 0) {
    mdLines.push('- none');
  } else {
    for (const check of perfGate.checks) {
      mdLines.push(`- ${check.ok ? 'PASS' : 'FAIL'} ${check.name} (${check.detail})`);
    }
  }

  mdLines.push('');
  mdLines.push('## Failed Checks');
  mdLines.push('');

  const failedChecks = results
    .flatMap((result) =>
      result.checks
        .filter((check) => !check.ok)
        .map((check) => `- ${result.id} ${check.name}${check.detail ? ` (${check.detail})` : ''}`),
    );

  if (failedChecks.length === 0) {
    mdLines.push('- none');
  } else {
    mdLines.push(...failedChecks);
  }

  const mdPath = path.join(runDir, 'report.md');
  fs.writeFileSync(mdPath, mdLines.join('\n'), 'utf-8');

  console.log(`[regression] results saved: ${jsonPath}`);
  console.log(`[regression] report saved: ${mdPath}`);

  if (failed > 0 || (perfGate.enabled && !perfGate.ok)) {
    process.exitCode = 1;
  }
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[regression] fatal: ${message}`);
  process.exit(1);
});
