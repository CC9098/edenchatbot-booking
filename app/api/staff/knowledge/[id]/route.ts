import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { AuthError, getCurrentUser, requireStaffRole } from "@/lib/auth-helpers";
import { deleteStaffKnowledgeNote, updateStaffKnowledgeNote } from "@/lib/staff-knowledge-base";

export const dynamic = "force-dynamic";

const noteSchema = z.object({
  title: z.string().trim().min(1, "請輸入標題").max(180),
  category: z.string().trim().min(1, "請輸入分類").max(80),
  sensitivity: z.enum(["public", "internal", "restricted"]).default("internal"),
  contentMd: z.string().trim().min(1, "請輸入內容").max(50000),
});

interface RouteContext {
  params: {
    id: string;
  };
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requireStaffRole(user.id);

    const parsed = noteSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "資料格式不正確" }, { status: 400 });
    }

    const item = await updateStaffKnowledgeNote(params.id, parsed.data, user.id);
    return NextResponse.json({ item });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error("[PATCH /api/staff/knowledge/[id]] unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requireStaffRole(user.id);
    await deleteStaffKnowledgeNote(params.id, user.id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error("[DELETE /api/staff/knowledge/[id]] unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
