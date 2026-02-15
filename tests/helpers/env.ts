import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local", override: false, quiet: true });
loadEnv({ path: ".env", override: false, quiet: true });

export type E2ERole = "doctor" | "patient" | "unrelated";

type RoleEnvMap = Record<E2ERole, { emailVar: string; passwordVar: string }>;

const ROLE_ENV_MAP: RoleEnvMap = {
  doctor: {
    emailVar: "E2E_DOCTOR_EMAIL",
    passwordVar: "E2E_DOCTOR_PASSWORD",
  },
  patient: {
    emailVar: "E2E_PATIENT_EMAIL",
    passwordVar: "E2E_PATIENT_PASSWORD",
  },
  unrelated: {
    emailVar: "E2E_UNRELATED_EMAIL",
    passwordVar: "E2E_UNRELATED_PASSWORD",
  },
};

export type RoleCredentials = {
  email: string;
  password: string;
};

export function getBaseUrl(): string {
  return (
    process.env.E2E_BASE_URL || "https://edenchatbot-booking.vercel.app"
  );
}

export function getSupabaseConfig(): { url: string; anonKey: string } {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY for E2E auth."
    );
  }

  return { url, anonKey };
}

export function getMissingRoleEnvVars(roles: E2ERole[]): string[] {
  const missing: string[] = [];

  for (const role of roles) {
    const { emailVar, passwordVar } = ROLE_ENV_MAP[role];
    if (!process.env[emailVar]) missing.push(emailVar);
    if (!process.env[passwordVar]) missing.push(passwordVar);
  }

  return missing;
}

export function getRoleCredentials(role: E2ERole): RoleCredentials {
  const { emailVar, passwordVar } = ROLE_ENV_MAP[role];
  const email = process.env[emailVar];
  const password = process.env[passwordVar];

  if (!email || !password) {
    throw new Error(`Missing ${emailVar} or ${passwordVar}.`);
  }

  return { email, password };
}
