import { NextResponse } from "next/server";
import { getCurrentUser, AuthError } from "@/lib/auth-helpers";
import { createServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * GET /api/profile/cross-method-status
 *
 * Returns { showBanner: boolean } indicating whether the cross-method
 * unification banner should be displayed.
 *
 * showBanner is true when ALL of the following hold:
 *   1. User is authenticated
 *   2. profiles.first_cross_method_login_banner_shown is false
 *   3. The auth.users row has BOTH an email AND a phone
 *   4. The email is NOT a synthetic WhatsApp-only email (wa_*@whatsapp.internal)
 *
 * This signals that the account has been linked across two auth methods
 * (WhatsApp OTP + email/Google OAuth) and the user hasn't seen the notice yet.
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ showBanner: false }, { status: 200 });
    }

    const supabase = createServiceClient();

    // 1. Check profiles flag.
    const { data: profileRow, error: profileErr } = await supabase
      .from("profiles")
      .select("first_cross_method_login_banner_shown")
      .eq("id", user.id)
      .maybeSingle();

    if (profileErr) {
      console.error(
        "[GET /api/profile/cross-method-status] profiles query error:",
        profileErr.message,
      );
      return NextResponse.json({ showBanner: false }, { status: 200 });
    }

    const bannerAlreadyShown =
      profileRow?.first_cross_method_login_banner_shown === true;

    if (bannerAlreadyShown) {
      return NextResponse.json({ showBanner: false });
    }

    // 2. Fetch the full auth.users record to inspect email + phone presence.
    const { data: userData, error: userErr } =
      await supabase.auth.admin.getUserById(user.id);

    if (userErr || !userData?.user) {
      console.error(
        "[GET /api/profile/cross-method-status] getUserById error:",
        userErr?.message ?? "no user data",
      );
      return NextResponse.json({ showBanner: false }, { status: 200 });
    }

    const authUser = userData.user;
    const email = authUser.email ?? "";
    const phone = authUser.phone ?? "";

    // Synthetic WhatsApp-only emails have the shape wa_<digits>@whatsapp.internal.
    // If the email is synthetic the account was created phone-first and has NOT
    // been linked to a real email/Google identity yet.
    const isRealEmail = email.length > 0 && !email.endsWith("@whatsapp.internal");
    const hasPhone = phone.length > 0;

    const showBanner = isRealEmail && hasPhone;

    return NextResponse.json({ showBanner });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[GET /api/profile/cross-method-status] unexpected error:", err);
    return NextResponse.json({ showBanner: false }, { status: 200 });
  }
}
