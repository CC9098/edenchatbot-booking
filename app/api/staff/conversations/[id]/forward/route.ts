import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AuthError } from "@/lib/auth-helpers";
import {
  getConversation,
  requireConversationContext,
} from "@/lib/eden-conversations-server";
import { getWhatsappForwardRecipients } from "@/lib/eden-whatsapp-forward-config";
import {
  previewWhatsappForward,
  sendWhatsappForward,
} from "@/lib/eden-whatsapp-forward-server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
const inputSchema = z.object({
  messageId: z.coerce.number().int().positive(),
  doctorId: z.string().min(1).max(30),
});
const sendSchema = inputSchema.extend({
  requestId: z.string().uuid(),
  token: z.string().regex(/^[a-f0-9]{64}$/),
});
const json = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
function failure(error: unknown) {
  return json(
    {
      error:
        error instanceof AuthError
          ? error.message
          : "未能確認轉寄狀態，請查看收件人對話。",
    },
    error instanceof AuthError ? error.status : 502,
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const ctx = await requireConversationContext();
    await getConversation(ctx, Number(params.id));
    if (!request.nextUrl.searchParams.has("doctorId")) {
      const recipients = getWhatsappForwardRecipients();
      // Keep `doctors` temporarily for older Eden Tools bundles; both keys
      // contain the same server-allowlisted recipients.
      return json({ recipients, doctors: recipients });
    }
    const input = inputSchema.safeParse(
      Object.fromEntries(request.nextUrl.searchParams),
    );
    if (!input.success) throw new AuthError(400, "請選擇訊息及收件人。");
    return json({
      preview: await previewWhatsappForward(ctx, Number(params.id), input.data),
    });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const ctx = await requireConversationContext(request);
    const input = sendSchema.safeParse(await request.json());
    if (!input.success) throw new AuthError(400, "請先預覽轉寄內容。");
    return json(await sendWhatsappForward(ctx, Number(params.id), input.data));
  } catch (error) {
    return failure(error);
  }
}
