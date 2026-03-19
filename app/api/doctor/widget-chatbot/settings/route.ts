import { NextRequest, NextResponse } from "next/server";

import { AuthError, getCurrentUser, requireStaffRole } from "@/lib/auth-helpers";
import { loadWidgetChatbotSettings, saveWidgetChatbotSettings } from "@/lib/widget-chatbot-settings-store";
import { normalizeWidgetChatbotSettings } from "@/lib/widget-chatbot-settings";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const staffRole = await requireStaffRole(user.id);
    const { settings, updatedAt } = await loadWidgetChatbotSettings();

    return NextResponse.json({
      role: staffRole.role,
      settings,
      updatedAt,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("[GET /api/doctor/widget-chatbot/settings] unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const staffRole = await requireStaffRole(user.id);
    const body = await request.json();
    const normalized = normalizeWidgetChatbotSettings(body);
    const saved = await saveWidgetChatbotSettings(normalized);

    return NextResponse.json({
      role: staffRole.role,
      settings: saved.settings,
      updatedAt: saved.updatedAt,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error("[PATCH /api/doctor/widget-chatbot/settings] unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
