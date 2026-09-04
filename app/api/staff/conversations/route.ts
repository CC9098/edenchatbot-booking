import { NextRequest, NextResponse } from "next/server";
import { AuthError } from "@/lib/auth-helpers";
import {
  requireConversationContext,
  listConversations,
} from "@/lib/eden-conversations-server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(request: NextRequest) {
  try {
    const ctx = await requireConversationContext();
    const q = request.nextUrl.searchParams;
    const page = Math.max(1, Math.min(500, Number(q.get("page")) || 1));
    const inboxId = Number(q.get("inbox")) || undefined;
    const data = await listConversations(ctx, {
      view: q.get("view") || "all",
      page,
      query: q.get("q") || "",
      inboxId,
    });
    return NextResponse.json(
      {
        ...data,
        actor: ctx.actor,
        inboxes: ctx.inboxes.map((i) => ({ id: i.id, name: i.name })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof AuthError ? error.message : "未能載入對話，請再試。",
      },
      {
        status: error instanceof AuthError ? error.status : 502,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
