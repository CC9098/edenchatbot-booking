#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadDotenv } from "dotenv";
import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const HONG_KONG_TIMEZONE = "Asia/Hong_Kong";
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const HK_PHONE_REGEX = /(?:\+?852[-\s]?)?([456789]\d{3})[-\s]?(\d{4})/g;

interface CliOptions {
  calendarId?: string;
  date?: string;
  limit?: number;
  summaryOnly: boolean;
}

interface DoctorScheduleRow {
  doctor_id: string | null;
  clinic_id: string | null;
  calendar_id: string | null;
  is_active: boolean | null;
}

interface CalendarMapping {
  doctorId: string;
  clinicId: string;
  calendarId: string;
}

type CandidateStatus = "ready" | "manual-review" | "blocked";
type PosStrategy = "name-first" | "phone-tiebreaker" | "phone-fallback" | "manual-review";

interface PlanCandidate {
  eventId: string;
  calendarId: string;
  eventSummary: string;
  appointmentDate: string;
  appointmentTime: string | null;
  inferredPatientName: string | null;
  inferredPhone: string | null;
  doctorId: string | null;
  clinicId: string | null;
  mappingCount: number;
  posStrategy: PosStrategy;
  status: CandidateStatus;
  manualReviewReasons: string[];
}

function loadEnvFiles() {
  const repoRoot = process.env.EDEN_REPO_ROOT?.trim();
  const candidates = [process.cwd(), repoRoot].filter((value): value is string => Boolean(value));

  for (const basePath of candidates) {
    for (const name of [".env.local", ".env"]) {
      const filePath = path.join(basePath, name);
      if (fs.existsSync(filePath)) {
        loadDotenv({ path: filePath, override: false, quiet: true });
      }
    }
  }
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
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

    if (arg === "--calendar-id") {
      options.calendarId = argv[index + 1];
      index += 1;
      continue;
    }

    if (arg === "--limit") {
      const next = Number.parseInt(argv[index + 1] || "", 10);
      if (Number.isNaN(next)) {
        throw new Error("--limit must be an integer");
      }
      options.limit = next;
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function printUsage() {
  console.log(
    [
      "Usage: generate-google-cal-pos-plan.ts [--date YYYY-MM-DD] [--calendar-id ID] [--limit N] [--summary-only]",
      "",
      "Examples:",
      "  generate-google-cal-pos-plan.ts --summary-only",
      "  generate-google-cal-pos-plan.ts --date 2026-04-08",
    ].join("\n"),
  );
}

function getRequestedDate(input?: string): string {
  if (!input) {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: HONG_KONG_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  }

  const normalized = input.trim();
  if (!ISO_DATE_PATTERN.test(normalized)) {
    throw new Error("date must use YYYY-MM-DD format");
  }

  return normalized;
}

function getDayWindow(date: string) {
  const timeMin = new Date(`${date}T00:00:00+08:00`);
  const timeMax = new Date(`${date}T23:59:59+08:00`);
  return { timeMin, timeMax };
}

function normalizeText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizePhone(value: string | null): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("852") && digits.length >= 11) {
    return digits;
  }
  return digits;
}

function extractPhone(text: string): string | null {
  const matches = Array.from(text.matchAll(HK_PHONE_REGEX));
  if (matches.length === 0) return null;
  const joined = `${matches[0][1]}${matches[0][2]}`;
  return normalizePhone(joined);
}

function extractLineValue(description: string, labels: string[]): string | null {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = description.match(new RegExp(`${escaped}\\s*:\\s*(.+)`));
    if (match?.[1]?.trim()) {
      return match[1].trim();
    }
  }
  return null;
}

function stripPhoneFromText(value: string): string {
  return value.replace(HK_PHONE_REGEX, " ").replace(/\s+/g, " ").trim();
}

function inferPatientName(summary: string, description: string): string | null {
  const structured =
    extractLineValue(description, ["Patient / 病人", "病人", "患者", "Patient"]) ||
    extractLineValue(description, ["Name", "姓名"]);
  if (structured) {
    return stripPhoneFromText(structured);
  }

  if (summary.includes(" - ")) {
    const suffix = summary.split(" - ").slice(1).join(" - ").trim();
    const cleaned = stripPhoneFromText(suffix);
    if (cleaned) return cleaned;
  }

  const cleanedSummary = stripPhoneFromText(summary);
  return cleanedSummary || null;
}

function inferPhone(summary: string, description: string): string | null {
  const structured =
    extractLineValue(description, ["Phone / 電話", "電話", "Phone", "手機"]) ||
    extractLineValue(description, ["WhatsApp", "Whatsapp"]);
  const fromStructured = normalizePhone(structured);
  if (fromStructured) return fromStructured;

  return extractPhone(`${summary}\n${description}`);
}

function inferClinicFromText(input: {
  summary: string;
  description: string;
  location: string;
  mappingClinicIds: string[];
}): string | null {
  const text = `${input.summary}\n${input.description}\n${input.location}`.toLowerCase();

  if (input.mappingClinicIds.includes("online")) {
    if (/(zoom|meet|teams|online|網上|視像)/i.test(text)) {
      return "online";
    }
  }

  if (input.mappingClinicIds.includes("jordan")) {
    if (/(佐敦|jordan)/i.test(text)) {
      return "jordan";
    }
  }

  if (input.mappingClinicIds.includes("central")) {
    if (/(中環|central)/i.test(text)) {
      return "central";
    }
  }

  if (input.mappingClinicIds.includes("tsuenwan")) {
    if (/(荃灣|tsuen wan|tsuenwan)/i.test(text)) {
      return "tsuenwan";
    }
  }

  return null;
}

async function getActiveMappings(calendarId?: string): Promise<CalendarMapping[]> {
  const supabase = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let query = supabase
    .from("doctor_schedules")
    .select("doctor_id, clinic_id, calendar_id, is_active")
    .eq("is_active", true);

  if (calendarId) {
    query = query.eq("calendar_id", calendarId);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  return ((data || []) as DoctorScheduleRow[])
    .map((row) => ({
      doctorId: normalizeText(row.doctor_id),
      clinicId: normalizeText(row.clinic_id),
      calendarId: normalizeText(row.calendar_id),
    }))
    .filter(
      (row): row is CalendarMapping =>
        Boolean(row.doctorId && row.clinicId && row.calendarId),
    );
}

async function getCalendarClient() {
  const auth = new google.auth.OAuth2(
    requireEnv("GOOGLE_CLIENT_ID"),
    requireEnv("GOOGLE_CLIENT_SECRET"),
    process.env.GOOGLE_REDIRECT_URI?.trim() || "http://localhost:5000/oauth2callback",
  );

  auth.setCredentials({
    refresh_token: requireEnv("GOOGLE_REFRESH_TOKEN"),
  });

  return google.calendar({ version: "v3", auth });
}

function formatTime(dateTime: string | null | undefined): string | null {
  if (!dateTime) return null;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: HONG_KONG_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(dateTime));
}

function buildCandidate(event: any, mappings: CalendarMapping[]): PlanCandidate {
  const summary = normalizeText(event?.summary) || "";
  const description = normalizeText(event?.description) || "";
  const location = normalizeText(event?.location) || "";
  const inferredPatientName = inferPatientName(summary, description);
  const inferredPhone = inferPhone(summary, description);
  const uniqueDoctorIds = Array.from(new Set(mappings.map((item) => item.doctorId)));
  const uniqueClinicIds = Array.from(new Set(mappings.map((item) => item.clinicId)));
  const resolvedClinicId =
    uniqueClinicIds.length === 1
      ? uniqueClinicIds[0]
      : inferClinicFromText({
          summary,
          description,
          location,
          mappingClinicIds: uniqueClinicIds,
        });

  const manualReviewReasons: string[] = [];
  let posStrategy: PosStrategy = "name-first";
  let status: CandidateStatus = "ready";

  if (!inferredPatientName) {
    status = "blocked";
    posStrategy = "manual-review";
    manualReviewReasons.push("missing-patient-name");
  }

  if (uniqueDoctorIds.length !== 1) {
    status = "manual-review";
    posStrategy = "manual-review";
    manualReviewReasons.push("ambiguous-doctor-mapping");
  }

  if (!resolvedClinicId) {
    if (status === "ready") {
      status = "manual-review";
    }
    manualReviewReasons.push("ambiguous-clinic-mapping");
  }

  if (!inferredPhone) {
    if (status === "ready") {
      status = "manual-review";
    }
    manualReviewReasons.push("missing-phone-for-tiebreaker");
  } else if (status === "ready") {
    posStrategy = "phone-tiebreaker";
  }

  if (status === "blocked") {
    posStrategy = "manual-review";
  }

  return {
    eventId: normalizeText(event?.id) || "",
    calendarId: normalizeText(event?.organizer?.email) || mappings[0]?.calendarId || "",
    eventSummary: summary,
    appointmentDate:
      normalizeText(event?.start?.date) ||
      new Intl.DateTimeFormat("en-CA", {
        timeZone: HONG_KONG_TIMEZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(event?.start?.dateTime || Date.now())),
    appointmentTime: formatTime(event?.start?.dateTime),
    inferredPatientName,
    inferredPhone,
    doctorId: uniqueDoctorIds.length === 1 ? uniqueDoctorIds[0] : null,
    clinicId: resolvedClinicId,
    mappingCount: mappings.length,
    posStrategy,
    status,
    manualReviewReasons,
  };
}

async function main() {
  loadEnvFiles();
  const options = parseArgs(process.argv.slice(2));
  const requestedDate = getRequestedDate(options.date);
  const limit = options.limit && options.limit > 0 ? options.limit : 500;
  const mappings = await getActiveMappings(options.calendarId);
  const mappingsByCalendar = new Map<string, CalendarMapping[]>();

  for (const mapping of mappings) {
    const list = mappingsByCalendar.get(mapping.calendarId) || [];
    list.push(mapping);
    mappingsByCalendar.set(mapping.calendarId, list);
  }

  const calendar = await getCalendarClient();
  const { timeMin, timeMax } = getDayWindow(requestedDate);
  const candidates: PlanCandidate[] = [];
  const calendarSummaries: Array<{ calendarId: string; mappingCount: number; events: number }> = [];

  for (const [calendarId, calendarMappings] of Array.from(mappingsByCalendar.entries()).slice(0, limit)) {
    const response = await calendar.events.list({
      calendarId,
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: true,
      showDeleted: false,
      orderBy: "startTime",
      maxResults: 2500,
    });

    const events = (response.data.items || []).filter((event) => event.status !== "cancelled");
    calendarSummaries.push({
      calendarId,
      mappingCount: calendarMappings.length,
      events: events.length,
    });

    for (const event of events) {
      candidates.push(buildCandidate(event, calendarMappings));
    }
  }

  const summary = {
    totalCalendarsScanned: calendarSummaries.length,
    totalEventsScanned: candidates.length,
    ready: candidates.filter((candidate) => candidate.status === "ready").length,
    manualReview: candidates.filter((candidate) => candidate.status === "manual-review").length,
    blocked: candidates.filter((candidate) => candidate.status === "blocked").length,
    missingPhone: candidates.filter((candidate) => !candidate.inferredPhone).length,
    ambiguousClinic: candidates.filter((candidate) =>
      candidate.manualReviewReasons.includes("ambiguous-clinic-mapping"),
    ).length,
  };

  const plan = {
    generatedAt: new Date().toISOString(),
    requestedDate,
    timezone: HONG_KONG_TIMEZONE,
    source: "google-calendar",
    calendarSummaries,
    summary,
    candidates,
  };

  if (options.summaryOnly) {
    console.log(
      JSON.stringify(
        {
          generatedAt: plan.generatedAt,
          requestedDate: plan.requestedDate,
          timezone: plan.timezone,
          source: plan.source,
          calendarSummaries: plan.calendarSummaries,
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
