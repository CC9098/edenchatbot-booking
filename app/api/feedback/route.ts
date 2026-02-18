import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth-helpers";
import { createServiceClient } from "@/lib/supabase";

const feedbackSchema = z.object({
  feedbackType: z.enum(["up", "down"]),
  source: z.enum(["widget_v1", "chat_v2"]),
  messageText: z.string().trim().min(1).max(12000),
  messageIndex: z.number().int().nonnegative().nullable().optional(),
  messageMode: z.string().trim().max(32).nullable().optional(),
  sessionId: z.string().trim().min(1).max(255).nullable().optional(),
  contextMessages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(12000),
      }),
    )
    .max(20)
    .default([]),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = feedbackSchema.parse(body);

    let userId: string | null = null;
    try {
      const user = await getCurrentUser();
      userId = user?.id ?? null;
    } catch {
      // Anonymous widget feedback is allowed.
    }

    const supabase = createServiceClient();
    const { error } = await supabase.from("message_feedback").insert({
      feedback_type: data.feedbackType,
      source: data.source,
      message_text: data.messageText,
      message_index: data.messageIndex ?? null,
      message_mode: data.messageMode ?? null,
      context_messages: data.contextMessages,
      session_id: data.sessionId ?? null,
      user_id: userId,
    });

    if (error) {
      console.error("[POST /api/feedback] insert error:", error.message);
      return NextResponse.json({ error: "Failed to save feedback" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid feedback payload", details: error.errors },
        { status: 400 },
      );
    }

    console.error("[POST /api/feedback] unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
