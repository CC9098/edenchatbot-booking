import {
  type APIRequestContext,
  type Browser,
  type BrowserContext,
  request as playwrightRequest,
} from "@playwright/test";
import {
  type E2ERole,
  getBaseUrl,
  getRoleCredentials,
  getSupabaseConfig,
} from "./env";

type SupabaseSignInResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at?: number;
  token_type: string;
  user: unknown;
};

type AuthCookie = {
  name: string;
  value: string;
};

function toBase64Url(value: string): string {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function getStorageKey(supabaseUrl: string): string {
  const host = new URL(supabaseUrl).hostname;
  const projectRef = host.split(".")[0];
  return `sb-${projectRef}-auth-token`;
}

function buildAuthCookie(
  supabaseUrl: string,
  session: SupabaseSignInResponse
): AuthCookie[] {
  const payload = {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_in: session.expires_in,
    expires_at:
      session.expires_at ||
      Math.floor(Date.now() / 1000) + Math.max(session.expires_in - 30, 60),
    token_type: session.token_type,
    user: session.user,
  };

  const raw = JSON.stringify(payload);
  const encoded = `base64-${toBase64Url(raw)}`;

  const key = getStorageKey(supabaseUrl);
  const chunkSize = 3000;

  if (encoded.length <= chunkSize) {
    return [{ name: key, value: encoded }];
  }

  const chunks: AuthCookie[] = [];
  for (let i = 0; i < encoded.length; i += chunkSize) {
    chunks.push({
      name: `${key}.${chunks.length}`,
      value: encoded.slice(i, i + chunkSize),
    });
  }
  return chunks;
}

async function signInWithPassword(role: E2ERole): Promise<AuthCookie[]> {
  const { email, password } = getRoleCredentials(role);
  const { url, anonKey } = getSupabaseConfig();
  const api = await playwrightRequest.newContext();

  try {
    const response = await api.post(`${url}/auth/v1/token?grant_type=password`, {
      headers: {
        apikey: anonKey,
        "Content-Type": "application/json",
      },
      data: { email, password },
    });

    if (!response.ok()) {
      const errorText = await response.text();
      throw new Error(
        `Password sign-in failed for ${role} (${response.status()}): ${errorText.slice(
          0,
          300
        )}`
      );
    }

    const session = (await response.json()) as SupabaseSignInResponse;
    return buildAuthCookie(url, session);
  } finally {
    await api.dispose();
  }
}

export async function createAuthenticatedContext(
  browser: Browser,
  role: E2ERole
): Promise<BrowserContext> {
  const cookies = await signInWithPassword(role);
  const baseURL = getBaseUrl();
  const base = new URL(baseURL);

  return browser.newContext({
    baseURL,
    storageState: {
      cookies: cookies.map((cookie) => ({
        name: cookie.name,
        value: cookie.value,
        domain: base.hostname,
        path: "/",
        httpOnly: false,
        secure: base.protocol === "https:",
        sameSite: "Lax",
        expires: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
      })),
      origins: [],
    },
  });
}

export async function createAuthenticatedApiContext(
  role: E2ERole
): Promise<APIRequestContext> {
  const cookies = await signInWithPassword(role);
  const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

  return playwrightRequest.newContext({
    baseURL: getBaseUrl(),
    extraHTTPHeaders: {
      Cookie: cookieHeader,
    },
  });
}

export async function getFirstPatientUserId(
  doctorApi: APIRequestContext
): Promise<string | null> {
  const res = await doctorApi.get("/api/doctor/patients?limit=1");
  if (!res.ok()) {
    throw new Error(`Failed to query doctor patients API (${res.status()}).`);
  }

  const data = (await res.json()) as {
    items?: Array<{ patientUserId?: string }>;
  };
  return data.items?.[0]?.patientUserId || null;
}
