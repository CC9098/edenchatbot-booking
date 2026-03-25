import { BookingTabFlow } from "@/components/booking/BookingTabFlow";
import { EmbedAutoHeightReporter } from "@/components/embed/EmbedAutoHeightReporter";
import { parseBookingInitialSelection } from "@/lib/booking-search-params";
import { getPublicBookableScheduleData } from "@/lib/bookable-schedule-data-server";

export const dynamic = "force-dynamic";

export default async function BookingEmbedPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const doctors = await getPublicBookableScheduleData();
  const initialSelection = parseBookingInitialSelection(searchParams);

  return (
    <main className="w-full px-3 py-3 text-slate-800 sm:px-4 sm:py-4">
      <EmbedAutoHeightReporter messageType="embed-booking-height" />
      <BookingTabFlow
        doctors={doctors}
        initialSelection={initialSelection}
        embedMode
        flowVariant="whatsapp"
      />
    </main>
  );
}
