import type { Metadata } from "next";
import { BookingTabFlow } from "@/components/booking/BookingTabFlow";

export const metadata: Metadata = {
  title: "預約服務 | 醫天圓",
  description: "在 Eden 內直接完成預約，不需跳出 App。",
};

export default function BookingPage() {
  return (
    <main className="patient-pane text-slate-800">
      <BookingTabFlow />
    </main>
  );
}
