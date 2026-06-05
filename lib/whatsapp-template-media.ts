import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import { createServiceClient } from "@/lib/supabase";

export const WHATSAPP_TEMPLATE_MEDIA_BUCKET = "whatsapp-template-media";
export const WHATSAPP_TEMPLATE_MEDIA_MAX_BYTES = 5 * 1024 * 1024;
export const WHATSAPP_TEMPLATE_MEDIA_ALLOWED_TYPES = ["image/jpeg", "image/png"] as const;

const TOKEN_VERSION = 1;
const DEFAULT_EXPIRY_SECONDS = 24 * 60 * 60;
const MIN_EXPIRY_SECONDS = 15 * 60;
const MAX_EXPIRY_SECONDS = 7 * 24 * 60 * 60;

export type WhatsappTemplateMediaUploadResult = {
  fileName: string;
  mediaUrl: string;
  objectPath: string;
  expiresAt: string;
  expiresInSeconds: number;
  contentType: string;
  size: number;
};

type WhatsappMediaTokenPayload = {
  v: number;
  b: string;
  p: string;
  e: number;
  m: string;
};

export class WhatsappTemplateMediaError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "WhatsappTemplateMediaError";
    this.status = status;
  }
}

function getSigningSecret(): string {
  const secret =
    process.env.WHATSAPP_MEDIA_LINK_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!secret) {
    throw new WhatsappTemplateMediaError(500, "Missing WhatsApp media signing secret");
  }

  return secret;
}

function encodeBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeBase64Url(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signTokenBody(body: string): string {
  return createHmac("sha256", getSigningSecret()).update(body).digest("base64url");
}

function safeCompare(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function clampExpirySeconds(value: unknown): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_EXPIRY_SECONDS;
  return Math.min(MAX_EXPIRY_SECONDS, Math.max(MIN_EXPIRY_SECONDS, Math.floor(numeric)));
}

function getFileExtension(contentType: string): "jpg" | "png" {
  return contentType === "image/png" ? "png" : "jpg";
}

function sanitizeFileName(name: string): string {
  const clean = name
    .trim()
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return clean || "whatsapp-image";
}

async function ensureWhatsappTemplateMediaBucket() {
  const supabase = createServiceClient();
  const { data, error } = await supabase.storage.getBucket(WHATSAPP_TEMPLATE_MEDIA_BUCKET);

  if (!error && data) return supabase;

  const { error: createError } = await supabase.storage.createBucket(WHATSAPP_TEMPLATE_MEDIA_BUCKET, {
    public: false,
    allowedMimeTypes: [...WHATSAPP_TEMPLATE_MEDIA_ALLOWED_TYPES],
    fileSizeLimit: WHATSAPP_TEMPLATE_MEDIA_MAX_BYTES,
  });

  if (createError && !/already exists/i.test(createError.message)) {
    throw new WhatsappTemplateMediaError(500, `Storage bucket unavailable: ${createError.message}`);
  }

  return supabase;
}

export function isAllowedWhatsappTemplateMediaType(contentType: string): boolean {
  return WHATSAPP_TEMPLATE_MEDIA_ALLOWED_TYPES.includes(
    contentType as (typeof WHATSAPP_TEMPLATE_MEDIA_ALLOWED_TYPES)[number],
  );
}

export function createWhatsappMediaToken(payload: Omit<WhatsappMediaTokenPayload, "v">): string {
  const body = encodeBase64Url(JSON.stringify({ ...payload, v: TOKEN_VERSION }));
  const signature = signTokenBody(body);
  return `${body}.${signature}`;
}

export function verifyWhatsappMediaToken(token: string): WhatsappMediaTokenPayload {
  const [body, signature, extra] = token.split(".");
  if (!body || !signature || extra) {
    throw new WhatsappTemplateMediaError(404, "Media link not found");
  }

  const expectedSignature = signTokenBody(body);
  if (!safeCompare(signature, expectedSignature)) {
    throw new WhatsappTemplateMediaError(404, "Media link not found");
  }

  let payload: WhatsappMediaTokenPayload;
  try {
    payload = JSON.parse(decodeBase64Url(body)) as WhatsappMediaTokenPayload;
  } catch {
    throw new WhatsappTemplateMediaError(404, "Media link not found");
  }

  if (
    payload.v !== TOKEN_VERSION ||
    payload.b !== WHATSAPP_TEMPLATE_MEDIA_BUCKET ||
    typeof payload.p !== "string" ||
    !payload.p ||
    typeof payload.e !== "number" ||
    typeof payload.m !== "string" ||
    !isAllowedWhatsappTemplateMediaType(payload.m)
  ) {
    throw new WhatsappTemplateMediaError(404, "Media link not found");
  }

  if (payload.e <= Math.floor(Date.now() / 1000)) {
    throw new WhatsappTemplateMediaError(410, "Media link expired");
  }

  return payload;
}

export async function uploadWhatsappTemplateMedia({
  file,
  expiresInSeconds,
  requestUrl,
}: {
  file: File;
  expiresInSeconds?: unknown;
  requestUrl: string;
}): Promise<WhatsappTemplateMediaUploadResult> {
  const contentType = file.type;

  if (!isAllowedWhatsappTemplateMediaType(contentType)) {
    throw new WhatsappTemplateMediaError(400, "只支援 JPG 或 PNG。");
  }

  if (file.size <= 0) {
    throw new WhatsappTemplateMediaError(400, "圖片檔案是空的。");
  }

  if (file.size > WHATSAPP_TEMPLATE_MEDIA_MAX_BYTES) {
    throw new WhatsappTemplateMediaError(400, "圖片不可超過 5MB。");
  }

  const expirySeconds = clampExpirySeconds(expiresInSeconds);
  const expiresAtEpochSeconds = Math.floor(Date.now() / 1000) + expirySeconds;
  const extension = getFileExtension(contentType);
  const safeName = sanitizeFileName(file.name);
  const today = new Date().toISOString().slice(0, 10);
  const objectPath = `${today}/${randomUUID()}-${safeName}.${extension}`;
  const supabase = await ensureWhatsappTemplateMediaBucket();

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error } = await supabase.storage.from(WHATSAPP_TEMPLATE_MEDIA_BUCKET).upload(objectPath, buffer, {
    cacheControl: "3600",
    contentType,
    upsert: false,
  });

  if (error) {
    throw new WhatsappTemplateMediaError(500, `圖片上載失敗：${error.message}`);
  }

  const token = createWhatsappMediaToken({
    b: WHATSAPP_TEMPLATE_MEDIA_BUCKET,
    p: objectPath,
    e: expiresAtEpochSeconds,
    m: contentType,
  });

  const mediaUrl = new URL(`/api/whatsapp-media/${token}`, requestUrl).toString();

  return {
    fileName: file.name || `${safeName}.${extension}`,
    mediaUrl,
    objectPath,
    expiresAt: new Date(expiresAtEpochSeconds * 1000).toISOString(),
    expiresInSeconds: expirySeconds,
    contentType,
    size: file.size,
  };
}

export async function downloadWhatsappTemplateMedia(token: string): Promise<{
  body: Blob;
  contentType: string;
  expiresAt: Date;
}> {
  const payload = verifyWhatsappMediaToken(token);
  const supabase = createServiceClient();
  const { data, error } = await supabase.storage.from(payload.b).download(payload.p);

  if (error || !data) {
    throw new WhatsappTemplateMediaError(404, "Media link not found");
  }

  return {
    body: data,
    contentType: payload.m,
    expiresAt: new Date(payload.e * 1000),
  };
}
