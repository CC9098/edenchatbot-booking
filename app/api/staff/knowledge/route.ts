import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { AuthError, getCurrentUser, requireStaffRole } from "@/lib/auth-helpers";
import {
  createStaffKnowledgeNote,
  deleteImportedStaffKnowledgeDocument,
  isVisibleStaffHandbookDocument,
  listStaffKnowledgeDocuments,
  searchStaffKnowledge,
  updateImportedStaffKnowledgeDocument,
} from "@/lib/staff-knowledge-base";

export const dynamic = "force-dynamic";

const noteSchema = z.object({
  title: z.string().trim().min(1, "請輸入標題").max(180),
  category: z.string().trim().min(1, "請輸入分類").max(80),
  sensitivity: z.enum(["public", "internal", "restricted"]).default("internal"),
  contentMd: z.string().trim().min(1, "請輸入內容").max(50000),
});

const importedDocumentSchema = noteSchema.extend({
  documentId: z.string().trim().min(1, "缺少匯入檔").max(500),
});

const deleteImportedDocumentSchema = z.object({
  documentId: z.string().trim().min(1, "缺少匯入檔").max(500),
});

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

    const documents = (await listStaffKnowledgeDocuments()).filter(isVisibleStaffHandbookDocument);
    return NextResponse.json({ items: documents });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("[GET /api/staff/knowledge] unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
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

    const item = await createStaffKnowledgeNote(parsed.data, user.id);
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error("[POST /api/staff/knowledge] unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requireStaffRole(user.id);

    const parsed = importedDocumentSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "資料格式不正確" }, { status: 400 });
    }

    const { documentId, ...noteInput } = parsed.data;
    const item = await updateImportedStaffKnowledgeDocument(documentId, noteInput, user.id);
    return NextResponse.json({ item });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error("[PUT /api/staff/knowledge] unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requireStaffRole(user.id);

    const parsed = deleteImportedDocumentSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "資料格式不正確" }, { status: 400 });
    }

    await deleteImportedStaffKnowledgeDocument(parsed.data.documentId, user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error("[DELETE /api/staff/knowledge] unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
