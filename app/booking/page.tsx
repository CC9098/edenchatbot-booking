import type { Metadata } from "next";
import { BookingTabFlow } from "@/components/booking/BookingTabFlow";
import { parseBookingInitialSelection } from "@/lib/booking-search-params";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getPublicBookableScheduleData } from "@/lib/bookable-schedule-data-server";
import { createServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "預約服務 | 醫天圓",
  description: "在 Eden 內直接完成預約，不需跳出 App。",
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
      console.error("[booking/page] failed to load profile prefill:", error.message);
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
    console.error("[booking/page] unexpected prefill error:", error);
    return null;
  }
}

export default async function BookingPage({
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
      />
    </main>
  );
}
