import "server-only";

import { createHmac, timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";
import { cookies } from "next/headers";

export const INSTRUCTIONTABLE_COOKIE_NAME = "instructiontable_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

function getInstructiontablePassword() {
  const password = process.env.INSTRUCTIONTABLE_PASSWORD?.trim();
  if (!password) {
    throw new Error("INSTRUCTIONTABLE_PASSWORD is not set");
  }
  return password;
}

function getInstructiontableSecret() {
  const secret =
    process.env.INSTRUCTIONTABLE_SESSION_SECRET?.trim() ||
    process.env.INSTRUCTIONTABLE_PASSWORD?.trim();
  if (!secret) {
    throw new Error(
      "INSTRUCTIONTABLE_SESSION_SECRET or INSTRUCTIONTABLE_PASSWORD is not set"
    );
  }
  return secret;
}

function signSession(expiresAtMs: number) {
  return createHmac("sha256", getInstructiontableSecret())
    .update(`instructiontable:${expiresAtMs}`)
    .digest("hex");
}

export function verifyInstructiontablePassword(password: string) {
  return password === getInstructiontablePassword();
}

export function createInstructiontableSessionToken() {
  const expiresAtMs = Date.now() + SESSION_TTL_MS;
  const signature = signSession(expiresAtMs);
  return `${expiresAtMs}.${signature}`;
}

export function getInstructiontableSessionMaxAgeSeconds() {
  return Math.floor(SESSION_TTL_MS / 1000);
}

export function isInstructiontableSessionTokenValid(
  token: string | undefined | null
) {
  if (!token) return false;
  const [expiresRaw, signatureRaw] = token.split(".");
  if (!expiresRaw || !signatureRaw) return false;

  const expiresAtMs = Number(expiresRaw);
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) return false;

  const expected = signSession(expiresAtMs);
  const expectedBuffer = Buffer.from(expected, "utf8");
  const actualBuffer = Buffer.from(signatureRaw, "utf8");
  if (expectedBuffer.length !== actualBuffer.length) return false;

  return timingSafeEqual(expectedBuffer, actualBuffer);
}

export function isInstructiontableSessionActiveFromCookies() {
  const cookieStore = cookies();
  const token = cookieStore.get(INSTRUCTIONTABLE_COOKIE_NAME)?.value;
  return isInstructiontableSessionTokenValid(token);
}

export function isInstructiontableSessionActiveFromRequest(request: NextRequest) {
  const token = request.cookies.get(INSTRUCTIONTABLE_COOKIE_NAME)?.value;
  return isInstructiontableSessionTokenValid(token);
}

