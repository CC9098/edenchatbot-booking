import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, AuthError } from "@/lib/auth-helpers";
import { createServiceClient } from "@/lib/supabase";
import { normalizePhoneForSearch } from "@/lib/contact-utils";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// GET /api/bookings/claim
// Returns orphan booking_intake rows that match the authenticated user's phone
// but have no user_id linked yet.
// Only shows past confirmed/cancelled bookings (not pending future ones).
// ---------------------------------------------------------------------------
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createServiceClient();

    // Fetch the user's profile to get phone_digits
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("phone, phone_digits")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("[GET /api/bookings/claim] profile query error:", profileError.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    // Derive phone_digits: prefer the generated column, fall back to normalizing phone
    const profilePhoneDigits: string =
      (profile?.phone_digits as string | null | undefined) ||
      normalizePhoneForSearch(profile?.phone as string | null | undefined);

    if (!profilePhoneDigits) {
      return NextResponse.json({ claimable: [] });
    }

    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    // Only surface confirmed/cancelled past bookings.
    // We exclude pending future appointments to avoid confusion with active WhatsApp-managed bookings.
    const { data: rows, error: queryError } = await supabase
      .from("booking_intake")
      .select(
        "id, appointment_date, appointment_time, doctor_name_zh, status, clinic_name_zh"
      )
      .eq("phone_digits", profilePhoneDigits)
      .is("user_id", null)
      .in("status", ["confirmed", "cancelled"])
      .lt("appointment_date", today)
      .order("appointment_date", { ascending: false })
      .limit(20);

    if (queryError) {
      console.error("[GET /api/bookings/claim] query error:", queryError.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    const claimable = (rows ?? []).map((row) => ({
      id: row.id as string,
      appointmentDate: row.appointment_date as string,
      appointmentTime: (row.appointment_time as string | null) ?? undefined,
      doctorNameZh: (row.doctor_name_zh as string | null) ?? undefined,
      serviceLabel: (row.clinic_name_zh as string | null) ?? undefined,
      status: row.status as string,
    }));

    return NextResponse.json({ claimable });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[GET /api/bookings/claim] unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/bookings/claim
// Body: { bookingIds: string[] }
// Links the given booking_intake rows to the authenticated user,
// after verifying each row belongs to the user's phone and has no user_id.
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    if (
      !body ||
      !Array.isArray(body.bookingIds) ||
      body.bookingIds.length === 0 ||
      body.bookingIds.some((id: unknown) => typeof id !== "string")
    ) {
      return NextResponse.json({ error: "Invalid input: bookingIds must be a non-empty string array" }, { status: 400 });
    }

    const bookingIds: string[] = body.bookingIds;

    const supabase = createServiceClient();

    // Fetch the user's profile phone_digits
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("phone, phone_digits")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("[POST /api/bookings/claim] profile query error:", profileError.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    const profilePhoneDigits: string =
      (profile?.phone_digits as string | null | undefined) ||
      normalizePhoneForSearch(profile?.phone as string | null | undefined);

    if (!profilePhoneDigits) {
      return NextResponse.json({ claimed: [], skipped: bookingIds });
    }

    // Fetch candidate rows matching the given IDs, with no user_id, past date
    const today = new Date().toISOString().slice(0, 10);

    const { data: candidates, error: fetchError } = await supabase
      .from("booking_intake")
      .select("id, phone_digits, user_id, appointment_date, status")
      .in("id", bookingIds);

    if (fetchError) {
      console.error("[POST /api/bookings/claim] fetch candidates error:", fetchError.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    const claimed: string[] = [];
    const skipped: string[] = [];

    for (const row of candidates ?? []) {
      const rowId = row.id as string;
      const rowPhoneDigits = row.phone_digits as string | null;
      const rowUserId = row.user_id as string | null;
      const rowDate = row.appointment_date as string;
      const rowStatus = row.status as string;

      // Safety checks:
      // 1. Phone must match the user's profile phone_digits
      // 2. Must have no user_id (truly orphaned)
      // 3. Must be a past appointment — we do NOT claim future pending bookings
      const phoneMatches = rowPhoneDigits === profilePhoneDigits;
      const isOrphan = rowUserId === null;
      const isPast = rowDate < today;
      const isHistorical = rowStatus === "confirmed" || rowStatus === "cancelled";

      if (phoneMatches && isOrphan && isPast && isHistorical) {
        claimed.push(rowId);
      } else {
        skipped.push(rowId);
      }
    }

    // IDs requested but not found in DB are also skipped
    const foundIds = new Set((candidates ?? []).map((r) => r.id as string));
    for (const id of bookingIds) {
      if (!foundIds.has(id)) skipped.push(id);
    }

    if (claimed.length > 0) {
      const { error: updateError } = await supabase
        .from("booking_intake")
        .update({ user_id: user.id, updated_at: new Date().toISOString() })
        .in("id", claimed);

      if (updateError) {
        console.error("[POST /api/bookings/claim] update error:", updateError.message);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
      }
    }

    return NextResponse.json({ claimed, skipped });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[POST /api/bookings/claim] unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
