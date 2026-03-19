import { createServiceClient } from "@/lib/supabase";
import {
  DEFAULT_WIDGET_CHATBOT_SETTINGS,
  normalizeWidgetChatbotSettings,
  type WidgetChatbotSettings,
} from "@/lib/widget-chatbot-settings";

const DEFAULT_SINGLETON_KEY = "default";

interface WidgetChatbotSettingsRow {
  singleton_key: string;
  config: unknown;
  updated_at: string;
}

export async function loadWidgetChatbotSettings(): Promise<{
  settings: WidgetChatbotSettings;
  updatedAt: string | null;
}> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("widget_chatbot_settings")
    .select("singleton_key, config, updated_at")
    .eq("singleton_key", DEFAULT_SINGLETON_KEY)
    .maybeSingle();

  if (error) {
    console.error("[widget-chatbot-settings] load error:", error.message);
    return {
      settings: DEFAULT_WIDGET_CHATBOT_SETTINGS,
      updatedAt: null,
    };
  }

  const row = data as WidgetChatbotSettingsRow | null;
  return {
    settings: normalizeWidgetChatbotSettings(row?.config),
    updatedAt: row?.updated_at ?? null,
  };
}

export async function saveWidgetChatbotSettings(settings: WidgetChatbotSettings): Promise<{
  settings: WidgetChatbotSettings;
  updatedAt: string;
}> {
  const supabase = createServiceClient();
  const normalized = normalizeWidgetChatbotSettings(settings);

  const { data, error } = await supabase
    .from("widget_chatbot_settings")
    .upsert(
      {
        singleton_key: DEFAULT_SINGLETON_KEY,
        config: normalized,
      },
      {
        onConflict: "singleton_key",
      }
    )
    .select("singleton_key, config, updated_at")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const row = data as WidgetChatbotSettingsRow;
  return {
    settings: normalizeWidgetChatbotSettings(row.config),
    updatedAt: row.updated_at,
  };
}
