import { createServiceClient } from "@/lib/supabase";
import { normalizePhoneForStorage } from "@/lib/contact-utils";

export async function syncPatientProfileContact(params: {
  userId?: string;
  displayName: string;
  phone: string;
}): Promise<{ success: boolean; skipped?: boolean; error?: string }> {
  const userId = params.userId?.trim();
  if (!userId) {
    return { success: true, skipped: true };
  }

  const displayName = params.displayName.trim();
  const phone = normalizePhoneForStorage(params.phone);
  if (!displayName || !phone) {
    return {
      success: false,
      error: "Missing display name or phone for profile sync",
    };
  }

  try {
    const supabase = createServiceClient();
    const { error } = await supabase.from("profiles").upsert(
      {
        id: userId,
        display_name: displayName,
        phone,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown profile sync error",
    };
  }
}
