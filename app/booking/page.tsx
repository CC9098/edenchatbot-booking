import { parseBookingLocale } from '@/shared/booking-locale';
import type { Metadata } from "next";
import { BookingTabFlow } from "@/components/booking/BookingTabFlow";
import { PublicBookingTabs } from "@/components/booking/PublicBookingTabs";
import { parseBookingInitialSelection } from "@/lib/booking-search-params";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getPublicBookableScheduleData } from "@/lib/bookable-schedule-data-server";
import { createServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const chineseMetadata: Metadata = {
  title: "預約服務 | 醫天圓",
  description: "成功預約後，診所會透過 WhatsApp 發送確認訊息。",
};

export function generateMetadata({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }): Metadata {
  return parseBookingLocale(searchParams?.lang) === 'en' ? { title: { absolute: 'Book an appointment | Eden Clinic' }, description: 'Book an appointment at Eden Clinic. Confirmation is sent by WhatsApp.' } : chineseMetadata;
}


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
  const locale = parseBookingLocale(searchParams?.lang);
  const initialSelection = parseBookingInitialSelection(searchParams);

  return (
    <main lang={locale === 'en' ? 'en-HK' : 'zh-Hant-HK'} className="patient-pane overflow-x-hidden text-slate-800">
      <div className="mx-auto max-w-5xl space-y-4">
        <PublicBookingTabs current="booking" locale={locale} />
        <BookingTabFlow
          locale={locale}
          doctors={doctors}
          initialContact={initialContact}
          initialSelection={initialSelection}
          flowVariant="whatsapp"
        />
      </div>
    </main>
  );
}
