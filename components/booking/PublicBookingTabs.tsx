import Link from 'next/link';
import { LogIn } from 'lucide-react';

import { buildManageBookingUrl } from '@/lib/public-url';

type PublicBookingTab = 'booking' | 'manage' | 'reschedule' | 'cancel';

function TabLink({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex min-h-11 items-center rounded-full border px-4 py-2 text-sm font-semibold transition ${
        active
          ? 'border-primary bg-primary text-white'
          : 'border-primary/20 bg-white text-primary hover:bg-primary-light'
      }`}
    >
      {label}
    </Link>
  );
}

export function PublicBookingTabs({
  current,
  manageToken,
}: {
  current: PublicBookingTab;
  manageToken?: string | null;
}) {
  const token = manageToken?.trim() || undefined;
  const links = [
    { href: '/booking-whatsapp', label: '新增預約', active: current === 'booking' },
    {
      href: buildManageBookingUrl({ token }),
      label: '預約管理',
      active: current === 'manage',
    },
    {
      href: buildManageBookingUrl({ action: 'reschedule', token }),
      label: '更改預約',
      active: current === 'reschedule',
    },
    {
      href: buildManageBookingUrl({ action: 'cancel', token }),
      label: '取消預約',
      active: current === 'cancel',
    },
  ];

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center rounded-full border border-primary/20 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:text-primary"
        >
          返回首頁
        </Link>
        {links.map((link) => (
          <TabLink key={link.href} href={link.href} label={link.label} active={link.active} />
        ))}
      </div>

      <Link
        href="/login"
        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-primary/20 bg-white px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary-light"
      >
        <LogIn className="h-4 w-4" />
        會員登入
      </Link>
    </div>
  );
}
