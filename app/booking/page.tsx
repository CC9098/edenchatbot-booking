import type { Metadata } from "next";
import { BookingTabFlow } from "@/components/booking/BookingTabFlow";
import { getPublicBookableScheduleData } from "@/lib/bookable-schedule-data-server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "預約服務 | 醫天圓",
  description: "在 Eden 內直接完成預約，不需跳出 App。",
};

export default async function BookingPage() {
  const doctors = await getPublicBookableScheduleData();

  return (
    <main className="patient-pane text-slate-800">
      <BookingTabFlow doctors={doctors} />
    </main>
  );
}
