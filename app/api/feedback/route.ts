import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export type FeedbackPayload = {
  feedback_type: "up" | "down";
  source: "widget_v1" | "chat_v2";
  message_text: string;
  message_index: number;
  message_mode?: string;
  /** 被評分訊息之前的對話上下文（最多 10 則） */
  context_messages: { role: string; content: string }[];
  session_id?: string;
};

export async function POST(req: NextRequest) {
  let body: FeedbackPayload;
  try {
    body = (await req.json()) as FeedbackPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const {
    feedback_type,
    source,
    message_text,
    message_index,
    message_mode,
    context_messages,
    session_id,
  } = body;

  if (!feedback_type || !source || !message_text) {
    return NextResponse.json(
      { error: "feedback_type, source and message_text are required" },
      { status: 400 }
    );
  }

  try {
    const supabase = createServiceClient();
    const { error } = await supabase.from("message_feedback").insert({
      feedback_type,
      source,
      message_text,
      message_index: message_index ?? null,
      message_mode: message_mode ?? null,
      context_messages: context_messages ?? [],
      session_id: session_id ?? null,
    });

    if (error) {
      console.error("[feedback] Supabase insert error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[feedback] Unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
