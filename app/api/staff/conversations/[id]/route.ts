import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AuthError } from "@/lib/auth-helpers";
import {
  requireConversationContext,
  conversationDetail,
  getConversation,
  updateConversation,
  sendConversationMessage,
} from "@/lib/eden-conversations-server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
type Context = { params: { id: string } };
function failure(error: unknown) {
  return NextResponse.json(
    {
      error:
        error instanceof AuthError
          ? error.message
          : "未能完成操作，請重新載入確認。",
    },
    {
      status: error instanceof AuthError ? error.status : 502,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
export async function GET(request: NextRequest, { params }: Context) {
  try {
    const ctx = await requireConversationContext();
    const cursor = request.nextUrl.searchParams.get("before");
    const before = cursor ? Number(cursor) : undefined;
    if (before !== undefined && (!Number.isSafeInteger(before) || before <= 0))
      throw new AuthError(400, "訊息位置無效。");
    return NextResponse.json(
      await conversationDetail(ctx, Number(params.id), before),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}
const actionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("claim"), revision: z.string() }),
  z.object({ type: z.literal("read"), revision: z.string() }),
  z.object({
    type: z.literal("stage"),
    revision: z.string(),
    stage: z.enum(["reply", "patient", "doctor", "done"]),
  }),
  z.object({
    type: z.literal("handover"),
    revision: z.string(),
    summary: z.string().trim().min(1).max(500),
    nextStep: z.string().trim().min(1).max(500),
    dueAt: z.string().max(40).optional(),
  }),
  z.object({
    type: z.literal("doctor"),
    revision: z.string(),
    doctorId: z.number().int().positive(),
  }),
]);
export async function POST(request: NextRequest, { params }: Context) {
  try {
    const ctx = await requireConversationContext(request);
    const raw = await getConversation(ctx, Number(params.id));
    const body = await request.json();
    const parsed = actionSchema.safeParse(body);
    if (!parsed.success) throw new AuthError(400, "請填妥操作內容。");
    return NextResponse.json(
      { conversation: await updateConversation(ctx, raw, parsed.data) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}
const messageSchema = z.object({
  content: z.string().trim().max(2000),
  private: z.boolean(),
  replyTo: z.number().int().positive().optional(),
  requestId: z.string().uuid(),
});
export async function PUT(request: NextRequest, { params }: Context) {
  try {
    const ctx = await requireConversationContext(request);
    const raw = await getConversation(ctx, Number(params.id));
    let body: unknown;
    let attachment: File | null = null;
    if (request.headers.get("content-type")?.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("attachment");
      attachment = file instanceof File && file.size > 0 ? file : null;
      body = {
        content: String(form.get("content") || ""),
        private: form.get("private") === "true",
        requestId: form.get("requestId"),
        ...(form.get("replyTo")
          ? { replyTo: Number(form.get("replyTo")) }
          : {}),
      };
    } else body = await request.json();
    const parsed = messageSchema.safeParse(body);
    if (!parsed.success || (!parsed.data.content && !attachment))
      throw new AuthError(400, "請輸入訊息或選擇附件。");
    const data = await sendConversationMessage(ctx, raw, {
      ...parsed.data,
      attachment,
    });
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return failure(error);
  }
}
