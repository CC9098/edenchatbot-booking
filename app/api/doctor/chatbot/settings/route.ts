import { NextResponse } from "next/server";

import { AuthError, getCurrentUser, requireStaffRole } from "@/lib/auth-helpers";
import {
  type ChatbotPromptType,
  isChatbotPromptType,
  sortChatbotPromptItems,
} from "@/lib/chatbot-prompt-settings";
import { createServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

interface ChatPromptSettingsRow {
  type: ChatbotPromptType;
  variant: string | null;
  enabled: boolean;
  is_active: boolean;
  prompt_md: string;
  gear_g1_md: string | null;
  gear_g2_md: string | null;
  gear_g3_md: string | null;
  extra_instructions_md: string | null;
  updated_at: string;
}

function mapChatPromptSetting(row: ChatPromptSettingsRow, canEditCorePrompt: boolean) {
  return {
    type: row.type,
    variant: row.variant,
    enabled: row.enabled,
    isActive: row.is_active,
    promptMd: row.prompt_md ?? "",
    gearG1Md: row.gear_g1_md ?? "",
    gearG2Md: row.gear_g2_md ?? "",
    gearG3Md: row.gear_g3_md ?? "",
    extraInstructionsMd: row.extra_instructions_md ?? "",
    updatedAt: row.updated_at,
    canEditCorePrompt,
  };
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const staffRole = await requireStaffRole(user.id);
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from("chat_prompt_settings")
      .select(
        "type, variant, enabled, is_active, prompt_md, gear_g1_md, gear_g2_md, gear_g3_md, extra_instructions_md, updated_at"
      );

    if (error) {
      console.error("[GET /api/doctor/chatbot/settings] query error:", error.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    const rows = sortChatbotPromptItems(
      ((data ?? []) as Array<Record<string, unknown>>)
        .filter((item): item is Record<string, unknown> & { type: string } => typeof item.type === "string")
        .filter((item) => isChatbotPromptType(item.type))
        .map((item) => item as unknown as ChatPromptSettingsRow)
    );

    return NextResponse.json({
      role: staffRole.role,
      items: rows.map((row) => mapChatPromptSetting(row, staffRole.role === "admin")),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("[GET /api/doctor/chatbot/settings] unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
