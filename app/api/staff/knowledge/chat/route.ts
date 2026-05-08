import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { AuthError, getCurrentUser, requireStaffRole } from "@/lib/auth-helpers";
import { answerStaffKnowledgeQuestion } from "@/lib/staff-knowledge-base";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  question: z.string().trim().min(1).max(600),
});

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requireStaffRole(user.id);

    const payload = requestSchema.safeParse(await request.json().catch(() => ({})));
    if (!payload.success) {
      return NextResponse.json({ error: "請輸入要查詢的問題" }, { status: 400 });
    }

    const answer = await answerStaffKnowledgeQuestion(payload.data.question);

    return NextResponse.json(answer);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("[POST /api/staff/knowledge/chat] unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
