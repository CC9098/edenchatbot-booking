import { NextRequest, NextResponse } from "next/server";

import { AuthError, getCurrentUser, requireStaffRole } from "@/lib/auth-helpers";
import {
  listStaffKnowledgeDocuments,
  searchStaffKnowledge,
} from "@/lib/staff-knowledge-base";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requireStaffRole(user.id);

    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") || "").trim();

    if (q) {
      const results = await searchStaffKnowledge(q, {
        includePlaceholders: true,
        limit: 20,
      });

      return NextResponse.json({
        items: results.map((result) => result.document),
        results: results.map((result) => ({
          id: result.document.id,
          score: result.score,
          snippets: result.snippets,
        })),
      });
    }

    const documents = await listStaffKnowledgeDocuments();
    return NextResponse.json({ items: documents });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("[GET /api/staff/knowledge] unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
