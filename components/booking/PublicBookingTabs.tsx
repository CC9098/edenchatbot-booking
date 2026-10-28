import Link from 'next/link';
import { LogIn } from 'lucide-react';
import { buildManageBookingUrl } from '@/lib/public-url';
import type { BookingLocale } from '@/shared/booking-locale';

function managePath(options: Parameters<typeof buildManageBookingUrl>[0]) {
  const url = new URL(buildManageBookingUrl(options));
  return `${url.pathname}${url.search}`;
}

type PublicBookingTab = 'booking' | 'timetable' | 'manage' | 'reschedule' | 'cancel';

export function PublicBookingTabs({ current, manageToken, locale = 'zh' }: {
  current: PublicBookingTab;
  manageToken?: string | null;
  locale?: BookingLocale;
}) {
  const en = locale === 'en';
  const token = manageToken?.trim() || undefined;
  const links = [
    { href: en ? '/en/booking' : '/booking-whatsapp', label: en ? 'Book an appointment' : '新增預約', active: current === 'booking' },
    { href: en ? '/en/practitioners' : '/embed/timetable', label: en ? 'Practitioners' : '醫師時間表', active: current === 'timetable' },
    { href: managePath({ token, locale }), label: en ? 'Manage appointments' : '預約管理', active: current === 'manage' },
    { href: managePath({ action: 'reschedule', token, locale }), label: en ? 'Reschedule' : '更改預約', active: current === 'reschedule' },
    { href: managePath({ action: 'cancel', token, locale }), label: en ? 'Cancel appointment' : '取消預約', active: current === 'cancel' },
  ];
  return (
    <nav aria-label={en ? 'Appointments' : '預約服務'} className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Link href={en ? '/en' : '/'} className="inline-flex min-h-11 items-center rounded-full border border-primary/20 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:text-primary">
          {en ? 'Home' : '返回首頁'}
        </Link>
        {links.map((link) => (
          <Link key={link.href} href={link.href} aria-current={link.active ? 'page' : undefined} className={`inline-flex min-h-11 items-center rounded-full border px-4 py-2 text-sm font-semibold transition ${link.active ? 'border-primary bg-primary text-white' : 'border-primary/20 bg-white text-primary hover:bg-primary-light'}`}>
            {link.label}
          </Link>
        ))}
      </div>
      {!en && <Link href="/my-bookings" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-primary/20 bg-white px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary-light"><LogIn className="h-4 w-4" />我的預約</Link>}
    </nav>
  );
}
