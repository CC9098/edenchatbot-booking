import fs from "node:fs";
import path from "node:path";
import type { Browser } from "@playwright/test";
import { createAuthenticatedContext } from "./auth";

const AUTH_DIR = path.join("output", "playwright", ".auth");
const PATIENT_STATE_PATH = path.join(AUTH_DIR, "patient.json");
const DEFAULT_MAX_AGE_MS = 6 * 60 * 60 * 1000;

function getMaxAgeMs(): number {
  const raw = process.env.E2E_AUTH_STATE_MAX_AGE_MS;
  if (!raw) return DEFAULT_MAX_AGE_MS;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_MAX_AGE_MS;
  return parsed;
}

function isFreshAuthState(filePath: string): boolean {
  if (!fs.existsSync(filePath)) return false;

  const stat = fs.statSync(filePath);
  const ageMs = Date.now() - stat.mtimeMs;
  return ageMs <= getMaxAgeMs();
}

export async function ensurePatientAuthState(
  browser: Browser
): Promise<string> {
  if (isFreshAuthState(PATIENT_STATE_PATH)) {
    return PATIENT_STATE_PATH;
  }

  fs.mkdirSync(AUTH_DIR, { recursive: true });

  const context = await createAuthenticatedContext(browser, "patient");
  try {
    await context.storageState({ path: PATIENT_STATE_PATH });
  } finally {
    await context.close();
  }

  return PATIENT_STATE_PATH;
}
