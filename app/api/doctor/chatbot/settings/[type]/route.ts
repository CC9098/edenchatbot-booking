import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { AuthError, getCurrentUser, requireStaffRole } from "@/lib/auth-helpers";
import {
  type ChatbotPromptType,
  isChatbotPromptType,
} from "@/lib/chatbot-prompt-settings";
import { createServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const UPDATE_CHATBOT_SETTING_SCHEMA = z.object({
  extraInstructionsMd: z.string().max(12000),
  gearG1Md: z.string().max(12000),
  gearG2Md: z.string().max(12000),
  gearG3Md: z.string().max(12000),
  promptMd: z.string().max(40000).optional(),
});

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

function normalizeTextarea(value: string): string {
  return value.replace(/\r\n/g, "\n").trim();
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

function assertRequiredPromptPlaceholders(currentPrompt: string, nextPrompt: string) {
  const requiredTokens = ["{{EXTRA_INSTRUCTIONS}}"];

  for (const token of requiredTokens) {
    if (!nextPrompt.includes(token)) {
      throw new Error(`promptMd 必須保留 ${token}`);
    }
  }

  if (currentPrompt.includes("{{KNOWLEDGE}}") && !nextPrompt.includes("{{KNOWLEDGE}}")) {
    throw new Error("promptMd 必須保留 {{KNOWLEDGE}}");
  }

  if (currentPrompt.includes("{{SOURCES}}") && !nextPrompt.includes("{{SOURCES}}")) {
    throw new Error("promptMd 必須保留 {{SOURCES}}");
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { type: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const staffRole = await requireStaffRole(user.id);
    const typeParam = params.type.trim().toLowerCase();

    if (!isChatbotPromptType(typeParam)) {
      return NextResponse.json({ error: "Unknown chatbot type" }, { status: 400 });
    }

    const body = await request.json();
    const parsed = UPDATE_CHATBOT_SETTING_SCHEMA.parse(body);
    const supabase = createServiceClient();

    const { data: existing, error: existingError } = await supabase
      .from("chat_prompt_settings")
      .select(
        "type, variant, enabled, is_active, prompt_md, gear_g1_md, gear_g2_md, gear_g3_md, extra_instructions_md, updated_at"
      )
      .eq("type", typeParam)
      .maybeSingle();

    if (existingError) {
      console.error("[PATCH /api/doctor/chatbot/settings/[type]] select error:", existingError.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    if (!existing) {
      return NextResponse.json({ error: "Chatbot setting not found" }, { status: 404 });
    }

    const payload: Record<string, string> = {
      extra_instructions_md: normalizeTextarea(parsed.extraInstructionsMd),
      gear_g1_md: normalizeTextarea(parsed.gearG1Md),
      gear_g2_md: normalizeTextarea(parsed.gearG2Md),
      gear_g3_md: normalizeTextarea(parsed.gearG3Md),
    };

    if (typeof parsed.promptMd === "string") {
      if (staffRole.role !== "admin") {
        return NextResponse.json({ error: "Forbidden: admin role required" }, { status: 403 });
      }

      const nextPrompt = normalizeTextarea(parsed.promptMd);
      if (!nextPrompt) {
        return NextResponse.json({ error: "promptMd is required" }, { status: 400 });
      }

      assertRequiredPromptPlaceholders(existing.prompt_md, nextPrompt);
      payload.prompt_md = nextPrompt;
    }

    const { data: updated, error: updateError } = await supabase
      .from("chat_prompt_settings")
      .update(payload)
      .eq("type", typeParam)
      .select(
        "type, variant, enabled, is_active, prompt_md, gear_g1_md, gear_g2_md, gear_g3_md, extra_instructions_md, updated_at"
      )
      .single();

    if (updateError) {
      console.error("[PATCH /api/doctor/chatbot/settings/[type]] update error:", updateError.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    return NextResponse.json({
      item: mapChatPromptSetting(updated as ChatPromptSettingsRow, staffRole.role === "admin"),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Invalid payload" }, { status: 400 });
    }

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error("[PATCH /api/doctor/chatbot/settings/[type]] unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
