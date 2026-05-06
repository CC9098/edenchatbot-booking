import type { Metadata } from "next";
import Link from "next/link";

import { BookingTabFlow } from "@/components/booking/BookingTabFlow";
import { getPublicBookableScheduleData } from "@/lib/bookable-schedule-data-server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "韓曉恩醫師預約預覽 | 醫天圓",
  description: "韓曉恩醫師預約頁面的精簡版預覽。",
};

function PreviewBookingTabs() {
  const links = [
    { href: "/booking/hon-preview", label: "新增預約", active: true },
    { href: "/manage-booking", label: "管理預約", active: false },
    { href: "/login", label: "會員登入", active: false },
  ];

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`inline-flex min-h-11 items-center rounded-full border px-4 py-2 text-sm font-semibold transition ${
              link.active
                ? "border-primary bg-primary text-white"
                : "border-primary/20 bg-white text-primary hover:bg-primary-light"
            }`}
          >
            {link.label}
          </Link>
        ))}
      </div>

      <Link
        href="/booking?doctor=hon"
        className="inline-flex min-h-11 items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-primary/30 hover:text-primary"
      >
        對照原版
      </Link>
    </div>
  );
}

export default async function HonPreviewBookingPage() {
  const doctors = await getPublicBookableScheduleData();

  return (
    <main className="patient-pane overflow-x-hidden text-slate-800">
      <div className="mx-auto max-w-5xl space-y-4">
        <PreviewBookingTabs />
        <BookingTabFlow
          doctors={doctors}
          initialSelection={{ doctorId: "hon" }}
          flowVariant="whatsapp"
          presentationVariant="minimalPreview"
        />
      </div>
    </main>
  );
}
