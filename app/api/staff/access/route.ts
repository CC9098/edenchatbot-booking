import { NextResponse } from "next/server";
import { z } from "zod";

import { AuthError, getCurrentUser, requireStaffManagerRole } from "@/lib/auth-helpers";
import { createServiceClient } from "@/lib/supabase";
import {
  getStaffAccessPreset,
  getStaffKindLabel,
  isStaffAccessPreset,
  normalizeStaffEmail,
  type StaffAccessPreset,
} from "@/lib/staff-access";

export const dynamic = "force-dynamic";

const staffAccessSchema = z.object({
  email: z.string().email(),
  preset: z.string().refine(isStaffAccessPreset, "Invalid staff access preset"),
});

const staffAccessPatchSchema = z.object({
  email: z.string().email(),
  preset: z.string().refine(isStaffAccessPreset, "Invalid staff access preset").optional(),
  isActive: z.boolean().optional(),
});

function mapStaffAccessRow(row: {
  email: string;
  role: string;
  staff_kind: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}) {
  return {
    email: row.email,
    role: row.role,
    staffKind: row.staff_kind,
    label: getStaffKindLabel(row.staff_kind, row.role),
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function staffAccessTableUnavailable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "42P01" || error.code === "PGRST205";
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const managerRole = await requireStaffManagerRole(user.id);
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("staff_access_emails")
      .select("email, role, staff_kind, is_active, created_at, updated_at")
      .order("is_active", { ascending: false })
      .order("email", { ascending: true });

    if (error) {
      if (staffAccessTableUnavailable(error)) {
        return NextResponse.json(
          { error: "Staff email access table is not available. Run the latest Supabase migration." },
          { status: 503 },
        );
      }

      console.error("[GET /api/staff/access] DB error:", error.message);
      return NextResponse.json({ error: "Failed to load staff access" }, { status: 500 });
    }

    return NextResponse.json({
      managerRole: managerRole.role,
      items: (data || []).map((row) => mapStaffAccessRow(row as Parameters<typeof mapStaffAccessRow>[0])),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("[GET /api/staff/access] unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requireStaffManagerRole(user.id);

    const parsed = staffAccessSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid staff access input" }, { status: 400 });
    }

    const email = normalizeStaffEmail(parsed.data.email);
    const preset = getStaffAccessPreset(parsed.data.preset as StaffAccessPreset);
    const supabase = createServiceClient();
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from("staff_access_emails")
      .upsert(
        {
          email,
          role: preset.role,
          staff_kind: preset.staffKind,
          is_active: true,
          created_by: user.id,
          updated_by: user.id,
          updated_at: now,
        },
        { onConflict: "email" },
      )
      .select("email, role, staff_kind, is_active, created_at, updated_at")
      .single();

    if (error) {
      console.error("[POST /api/staff/access] DB error:", error.message);
      return NextResponse.json({ error: "Failed to save staff access" }, { status: 500 });
    }

    return NextResponse.json({ item: mapStaffAccessRow(data as Parameters<typeof mapStaffAccessRow>[0]) });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("[POST /api/staff/access] unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requireStaffManagerRole(user.id);

    const parsed = staffAccessPatchSchema.safeParse(await request.json());
    if (!parsed.success || (parsed.data.preset === undefined && parsed.data.isActive === undefined)) {
      return NextResponse.json({ error: "Invalid staff access update" }, { status: 400 });
    }

    const email = normalizeStaffEmail(parsed.data.email);
    const update: Record<string, string | boolean> = {
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    };

    if (parsed.data.preset) {
      const preset = getStaffAccessPreset(parsed.data.preset as StaffAccessPreset);
      update.role = preset.role;
      update.staff_kind = preset.staffKind;
    }
    if (typeof parsed.data.isActive === "boolean") {
      update.is_active = parsed.data.isActive;
    }

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("staff_access_emails")
      .update(update)
      .eq("email", email)
      .select("email, role, staff_kind, is_active, created_at, updated_at")
      .single();

    if (error) {
      console.error("[PATCH /api/staff/access] DB error:", error.message);
      return NextResponse.json({ error: "Failed to update staff access" }, { status: 500 });
    }

    return NextResponse.json({ item: mapStaffAccessRow(data as Parameters<typeof mapStaffAccessRow>[0]) });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("[PATCH /api/staff/access] unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
