import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { createServiceClient } from "@/lib/supabase";
import {
  getConfiguredTrialDays,
  resolveSubscriptionAccess,
} from "@/lib/subscription";

export const dynamic = "force-dynamic";

type UserSubscriptionRow = {
  id: string;
  plan_code: string | null;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  updated_at: string;
};

type MembershipPlanRow = {
  code: string;
  name: string;
  currency: string;
  amount_monthly: number;
  is_active: boolean;
};

/**
 * GET /api/me/subscription
 * Returns effective subscription/trial access for current user.
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const trialDays = getConfiguredTrialDays(process.env.MEMBERSHIP_TRIAL_DAYS);
    const supabase = createServiceClient();

    const {
      data: subscriptionRows,
      error: subscriptionError,
    } = await supabase
      .from("user_subscriptions")
      .select(
        "id, plan_code, status, current_period_end, cancel_at_period_end, updated_at"
      )
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(1);

    // Billing schema may not exist in older environments yet.
    if (subscriptionError && subscriptionError.code !== "42P01") {
      console.error(
        "[GET /api/me/subscription] subscription query error:",
        subscriptionError.message
      );
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }

    const subscription =
      (subscriptionRows?.[0] as UserSubscriptionRow | undefined) ?? null;

    let plan: MembershipPlanRow | null = null;
    if (subscription?.plan_code) {
      const { data: planRow, error: planError } = await supabase
        .from("membership_plans")
        .select("code, name, currency, amount_monthly, is_active")
        .eq("code", subscription.plan_code)
        .maybeSingle();

      if (planError && planError.code !== "42P01") {
        console.error(
          "[GET /api/me/subscription] membership_plans query error:",
          planError.message
        );
        return NextResponse.json(
          { error: "Internal server error" },
          { status: 500 }
        );
      }

      plan = (planRow as MembershipPlanRow | null) ?? null;
    }

    const access = resolveSubscriptionAccess({
      status: subscription?.status ?? null,
      currentPeriodEnd: subscription?.current_period_end ?? null,
      userCreatedAt: user.created_at ?? null,
      trialDays,
    });

    return NextResponse.json({
      billingReady: !(subscriptionError && subscriptionError.code === "42P01"),
      userId: user.id,
      hasAccess: access.hasAccess,
      accessSource: access.source,
      trial: {
        isActive: access.isTrialActive,
        startsAt: user.created_at ?? null,
        endsAt: access.trialEndsAt,
        days: access.trialDays,
      },
      subscription: subscription
        ? {
            id: subscription.id,
            planCode: subscription.plan_code,
            status: subscription.status,
            currentPeriodEnd: subscription.current_period_end,
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
            updatedAt: subscription.updated_at,
          }
        : null,
      plan: plan
        ? {
            code: plan.code,
            name: plan.name,
            currency: plan.currency,
            amountMonthly: plan.amount_monthly,
            isActive: plan.is_active,
          }
        : null,
    });
  } catch (error) {
    console.error("[GET /api/me/subscription] unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
