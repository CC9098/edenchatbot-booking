import { getCurrentUser, requireStaffRole } from '@/lib/auth-helpers';
import { verifyChatwootEdenToolsRequest } from '@/lib/chatwoot-eden-tools-session';
import { isDoctorLookBusyEnabled } from '@/shared/clinic-data';
import { isLookBusyGloballyEnabled } from '@/lib/look-busy';

type RequestLike = Pick<Request, 'headers'>;

export type StaffViewerDeps = {
  verifyChatwootToken: (request: RequestLike) => unknown | null;
  getCurrentUser: () => Promise<{ id: string } | null>;
  requireStaffRole: (userId: string) => Promise<unknown>;
};

const defaultDeps: StaffViewerDeps = {
  verifyChatwootToken: verifyChatwootEdenToolsRequest,
  getCurrentUser,
  requireStaffRole,
};

/** Supabase SSR stores the session in `sb-<ref>-auth-token` (optionally chunked `.0`, `.1`). */
export function hasSupabaseAuthCookie(cookieHeader: string | null | undefined): boolean {
  if (!cookieHeader) return false;
  return cookieHeader
    .split(';')
    .some((part) => /^sb-[^=]*-auth-token(\.\d+)?=/.test(part.trim()));
}

/**
 * True only when the server verifies a staff identity: a signed Chatwoot
 * Eden-tools session token, or a Supabase session whose user passes
 * `requireStaffRole`. Any client-supplied flag is ignored. Errors resolve to
 * the patient view.
 */
export async function isVerifiedStaffViewer(
  request: RequestLike,
  deps: StaffViewerDeps = defaultDeps
): Promise<boolean> {
  try {
    if (deps.verifyChatwootToken(request)) return true;
  } catch {
    // fall through to cookie session
  }

  if (!hasSupabaseAuthCookie(request.headers.get('cookie'))) return false;

  try {
    const user = await deps.getCurrentUser();
    if (!user) return false;
    await deps.requireStaffRole(user.id);
    return true;
  } catch {
    return false;
  }
}

/** Look-busy applies only when the global switch, the doctor switch are on and the viewer is not staff. */
export async function shouldApplyLookBusy(
  request: RequestLike,
  doctorId: string,
  deps: StaffViewerDeps = defaultDeps,
  env: Record<string, string | undefined> = process.env
): Promise<boolean> {
  if (!isLookBusyGloballyEnabled(env)) return false;
  if (!isDoctorLookBusyEnabled(doctorId)) return false;
  return !(await isVerifiedStaffViewer(request, deps));
}
