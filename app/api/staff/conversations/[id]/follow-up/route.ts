import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AuthError } from "@/lib/auth-helpers";
import {
  getConversation,
  requireConversationContext,
  conversationRequest,
} from "@/lib/eden-conversations-server";
import { sendStaffPatientWhatsappMessage } from "@/lib/chatwoot-whatsapp";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
const schema = z.object({
  content: z.string().trim().min(1).max(900),
  requestId: z.string().uuid(),
});
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const ctx = await requireConversationContext(request);
    const raw = await getConversation(ctx, Number(params.id));
    const input = schema.safeParse(await request.json());
    if (!input.success)
      throw new AuthError(400, "請輸入 900 字以內嘅跟進訊息。");
    const prior = raw.custom_attributes?.eden_followup_request as
      | { id?: string; actorId?: string; status?: string }
      | undefined;
    if (prior?.id === input.data.requestId && prior.actorId === ctx.actor.id) {
      if (prior.status === "sent")
        return NextResponse.json({ success: true, duplicate: true });
      throw new AuthError(
        409,
        "呢則訊息已提交，請先查看對話嘅送達狀態，避免重覆發送。",
      );
    }
    const inbox = await conversationRequest<{ phone_number?: string }>(
      ctx,
      `/inboxes/${raw.inbox_id}`,
    );
    if (!raw.meta?.sender?.phone_number || !inbox.phone_number)
      throw new AuthError(400, "未能確認 WhatsApp 號碼。");
    const tracking = {
      id: input.data.requestId,
      actorId: ctx.actor.id,
      actor: ctx.actor.name,
      status: "pending",
    };
    await conversationRequest(
      ctx,
      `/conversations/${raw.id}/custom_attributes`,
      {
        custom_attributes: {
          eden_followup_request: tracking,
          eden_flow_state: "human",
        },
      },
    );
    const result = await sendStaffPatientWhatsappMessage({
      patientName: raw.meta.sender.name || "病人",
      phone: raw.meta.sender.phone_number,
      clinicWhatsappPhone: inbox.phone_number,
      clinicNameZh: "醫天圓中醫診所",
      purpose: "follow_up",
      note: input.data.content,
      conversationId: raw.id,
    });
    await conversationRequest(
      ctx,
      `/conversations/${raw.id}/custom_attributes`,
      {
        custom_attributes: {
          eden_followup_request: {
            ...tracking,
            status: result.whatsappSent ? "sent" : "uncertain",
          },
        },
      },
    );
    if (!result.whatsappSent)
      throw new AuthError(
        502,
        "跟進訊息未能確認送達，請查看對話狀態後再處理。",
      );
    return NextResponse.json(
      { success: true, deliveryStatus: result.deliveryStatus },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof AuthError
            ? error.message
            : "未能確認跟進訊息狀態，請重新載入對話查看。",
      },
      {
        status: error instanceof AuthError ? error.status : 502,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
