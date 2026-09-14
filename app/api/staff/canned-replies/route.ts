import { NextResponse } from "next/server";
import { AuthError } from "@/lib/auth-helpers";
import {
  conversationRequest,
  requireConversationContext,
} from "@/lib/eden-conversations-server";
import {
  normalizeStaffCannedReplies,
  type StaffCannedReply,
} from "@/lib/staff-canned-replies";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET() {
  try {
    const context = await requireConversationContext();
    const raw = await conversationRequest<unknown>(context, "/canned_responses");
    const replies = normalizeStaffCannedReplies(raw);
    return NextResponse.json(
      { replies } satisfies { replies: StaffCannedReply[] },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof AuthError
            ? error.message
            : "未能載入常用回覆，請再試。",
      },
      {
        status: error instanceof AuthError ? error.status : 502,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
