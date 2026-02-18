const ACCESS_GRANTED_STATUSES = new Set(["trialing", "active"]);

export type SubscriptionAccessSource = "subscription" | "trial" | "none";

export interface SubscriptionAccessResult {
  hasAccess: boolean;
  source: SubscriptionAccessSource;
  isTrialActive: boolean;
  trialEndsAt: string | null;
  trialDays: number;
}

const DEFAULT_TRIAL_DAYS = 14;
const MIN_TRIAL_DAYS = 0;
const MAX_TRIAL_DAYS = 365;

export function getConfiguredTrialDays(raw: string | undefined): number {
  const parsed = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(parsed)) return DEFAULT_TRIAL_DAYS;
  return Math.max(MIN_TRIAL_DAYS, Math.min(MAX_TRIAL_DAYS, parsed));
}

export function hasSubscriptionAccess(
  status: string | null | undefined,
  currentPeriodEnd: string | null | undefined,
  now: Date = new Date()
): boolean {
  if (!status || !ACCESS_GRANTED_STATUSES.has(status)) return false;
  if (!currentPeriodEnd) return true;

  const periodEnd = new Date(currentPeriodEnd);
  if (Number.isNaN(periodEnd.getTime())) return false;
  return periodEnd.getTime() >= now.getTime();
}

export function computeTrialEndsAt(
  userCreatedAt: string | null | undefined,
  trialDays: number
): Date | null {
  if (!userCreatedAt || trialDays <= 0) return null;
  const createdAt = new Date(userCreatedAt);
  if (Number.isNaN(createdAt.getTime())) return null;

  const trialEnd = new Date(createdAt.getTime());
  trialEnd.setDate(trialEnd.getDate() + trialDays);
  return trialEnd;
}

export function resolveSubscriptionAccess(input: {
  status?: string | null;
  currentPeriodEnd?: string | null;
  userCreatedAt?: string | null;
  trialDays: number;
  now?: Date;
}): SubscriptionAccessResult {
  const now = input.now ?? new Date();

  if (hasSubscriptionAccess(input.status, input.currentPeriodEnd, now)) {
    return {
      hasAccess: true,
      source: "subscription",
      isTrialActive: false,
      trialEndsAt: null,
      trialDays: input.trialDays,
    };
  }

  const trialEnd = computeTrialEndsAt(input.userCreatedAt, input.trialDays);
  const isTrialActive = trialEnd ? trialEnd.getTime() >= now.getTime() : false;

  if (isTrialActive) {
    return {
      hasAccess: true,
      source: "trial",
      isTrialActive: true,
      trialEndsAt: trialEnd!.toISOString(),
      trialDays: input.trialDays,
    };
  }

  return {
    hasAccess: false,
    source: "none",
    isTrialActive: false,
    trialEndsAt: trialEnd ? trialEnd.toISOString() : null,
    trialDays: input.trialDays,
  };
}
