export type BookingReminderCronAuthResult =
  | { success: true; mode: 'cron' | 'dry-run-test' }
  | { success: false; status: 401 | 500; error: string };

function normalizeSecret(value: string | undefined): string {
  return value?.trim() || '';
}

function matchesBearer(authHeader: string | null, secret: string): boolean {
  return Boolean(secret && authHeader === `Bearer ${secret}`);
}

export function authorizeBookingReminderCronRequest(params: {
  authHeader: string | null;
  dryRun: boolean;
  cronSecret: string | undefined;
  dryRunTestSecret: string | undefined;
}): BookingReminderCronAuthResult {
  const cronSecret = normalizeSecret(params.cronSecret);
  const dryRunTestSecret = normalizeSecret(params.dryRunTestSecret);

  if (matchesBearer(params.authHeader, cronSecret)) {
    return { success: true, mode: 'cron' };
  }

  if (params.dryRun && matchesBearer(params.authHeader, dryRunTestSecret)) {
    return { success: true, mode: 'dry-run-test' };
  }

  if (!cronSecret) {
    return { success: false, status: 500, error: 'CRON_SECRET is not configured' };
  }

  return { success: false, status: 401, error: 'Unauthorized' };
}
