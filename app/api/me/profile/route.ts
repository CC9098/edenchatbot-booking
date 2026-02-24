import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, AuthError } from "@/lib/auth-helpers";
import { createServiceClient } from "@/lib/supabase";
import { normalizePhoneForSearch, normalizePhoneForStorage } from "@/lib/contact-utils";

const profileUpdateSchema = z
  .object({
    displayName: z.string().trim().min(2).max(80),
    phone: z.string().trim().min(8).max(40),
  })
  .strict();

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("display_name, phone")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      console.error("[GET /api/me/profile] profile query error:", error.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    const displayName = data?.display_name || null;
    const phone = data?.phone || null;

    return NextResponse.json({
      userId: user.id,
      email: user.email || null,
      displayName,
      phone,
      missingRequiredContact: !displayName || !phone,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[GET /api/me/profile] unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const parsed = profileUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid input",
          details: parsed.error.errors,
        },
        { status: 400 },
      );
    }

    const displayName = parsed.data.displayName.trim();
    const phone = normalizePhoneForStorage(parsed.data.phone);
    if (normalizePhoneForSearch(phone).length < 8) {
      return NextResponse.json({ error: "電話號碼格式不正確" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { error } = await supabase.from("profiles").upsert(
      {
        id: user.id,
        display_name: displayName,
        phone,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );

    if (error) {
      console.error("[PATCH /api/me/profile] upsert error:", error.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      profile: {
        displayName,
        phone,
      },
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[PATCH /api/me/profile] unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
