import { NextResponse } from "next/server";

import { loadWidgetChatbotSettings } from "@/lib/widget-chatbot-settings-store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { settings, updatedAt } = await loadWidgetChatbotSettings();
    return NextResponse.json({
      settings,
      updatedAt,
    });
  } catch (error) {
    console.error("[GET /api/public/widget-chatbot-settings] unexpected error:", error);
    return NextResponse.json({ error: "Failed to load widget chatbot settings" }, { status: 500 });
  }
}
