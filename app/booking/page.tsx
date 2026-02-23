import type { Metadata } from 'next';
import { BookingTabFlow } from '@/components/booking/BookingTabFlow';

export const metadata: Metadata = {
  title: '預約服務 | 醫天圓',
  description: '在 Eden 手機 App 內直接完成預約，不需跳到外部瀏覽器。',
};

export default function BookingPage() {
  return (
    <main className="patient-pane text-slate-800">
      <BookingTabFlow />
    </main>
  );
}
