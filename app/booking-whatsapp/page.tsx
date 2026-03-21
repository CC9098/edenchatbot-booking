import type { Metadata } from "next";

import { BookingTabFlow } from "@/components/booking/BookingTabFlow";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getPublicBookableScheduleData } from "@/lib/bookable-schedule-data-server";
import { parseBookingInitialSelection } from "@/lib/booking-search-params";
import { createServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "WhatsApp 預約 | 醫天圓",
  description: "先選擇醫師與時段，再透過 WhatsApp 交由姑娘確認。",
};

async function getInitialBookingContact() {
  try {
    const user = await getCurrentUser();
    if (!user) return null;

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("display_name, phone")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      console.error("[booking-whatsapp/page] failed to load profile prefill:", error.message);
    }

    const metadataDisplayName =
      typeof user.user_metadata?.full_name === "string"
        ? user.user_metadata.full_name.trim()
        : typeof user.user_metadata?.name === "string"
          ? user.user_metadata.name.trim()
          : "";

    const metadataPhone =
      typeof user.phone === "string" && user.phone.trim()
        ? user.phone.trim()
        : typeof user.user_metadata?.phone === "string"
          ? user.user_metadata.phone.trim()
          : "";

    return {
      displayName: data?.display_name || metadataDisplayName || null,
      email: user.email || null,
      phone: data?.phone || metadataPhone || null,
    };
  } catch (error) {
    console.error("[booking-whatsapp/page] unexpected prefill error:", error);
    return null;
  }
}

export default async function BookingWhatsappPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const [doctors, initialContact] = await Promise.all([
    getPublicBookableScheduleData(),
    getInitialBookingContact(),
  ]);
  const initialSelection = parseBookingInitialSelection(searchParams);

  return (
    <main className="patient-pane text-slate-800">
      <BookingTabFlow
        doctors={doctors}
        initialContact={initialContact}
        initialSelection={initialSelection}
        flowVariant="whatsapp"
      />
    </main>
  );
}
