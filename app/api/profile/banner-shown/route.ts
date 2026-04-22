import { NextResponse } from "next/server";
import { getCurrentUser, AuthError } from "@/lib/auth-helpers";
import { createServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * POST /api/profile/banner-shown
 *
 * Marks first_cross_method_login_banner_shown = true for the current user.
 * Called when the cross-method unification banner is dismissed or auto-dismissed.
 */
export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createServiceClient();
    const { error } = await supabase
      .from("profiles")
      .update({ first_cross_method_login_banner_shown: true })
      .eq("id", user.id);

    if (error) {
      console.error("[POST /api/profile/banner-shown] update error:", error.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[POST /api/profile/banner-shown] unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
