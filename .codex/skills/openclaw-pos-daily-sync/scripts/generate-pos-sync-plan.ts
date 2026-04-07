#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadDotenv } from "dotenv";

import { getDailyPosSyncPlan } from "../../../../lib/pos-sync-daily-plan";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../../../..");

function loadRepoEnv() {
  for (const relativePath of [".env.local", ".env"]) {
    const filePath = path.join(REPO_ROOT, relativePath);
    if (fs.existsSync(filePath)) {
      loadDotenv({ path: filePath, override: false, quiet: true });
    }
  }
}

interface CliOptions {
  clinicId?: string;
  date?: string;
  limit?: number;
  summaryOnly: boolean;
}

function printUsage() {
  console.log(
    [
      "Usage: generate-pos-sync-plan.ts [--date YYYY-MM-DD] [--clinic-id CLINIC] [--limit N] [--summary-only]",
      "",
      "Examples:",
      "  generate-pos-sync-plan.ts --summary-only",
      "  generate-pos-sync-plan.ts --date 2026-04-08 --clinic-id jordan",
    ].join("\n"),
  );
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { summaryOnly: false };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    }

    if (arg === "--summary-only") {
      options.summaryOnly = true;
      continue;
    }

    if (arg === "--date") {
      options.date = argv[index + 1];
      index += 1;
      continue;
    }

    if (arg === "--clinic-id") {
      options.clinicId = argv[index + 1];
      index += 1;
      continue;
    }

    if (arg === "--limit") {
      const raw = argv[index + 1];
      const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
      if (Number.isNaN(parsed)) {
        throw new Error("--limit must be an integer");
      }
      options.limit = parsed;
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

async function main() {
  loadRepoEnv();
  const options = parseArgs(process.argv.slice(2));
  const plan = await getDailyPosSyncPlan({
    clinicId: options.clinicId,
    date: options.date,
    limit: options.limit,
  });

  if (options.summaryOnly) {
    console.log(
      JSON.stringify(
        {
          generatedAt: plan.generatedAt,
          requestedDate: plan.requestedDate,
          timezone: plan.timezone,
          clinicId: plan.clinicId,
          source: plan.source,
          summary: plan.summary,
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log(JSON.stringify(plan, null, 2));
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
