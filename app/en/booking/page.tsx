import type { Metadata } from 'next';
import SharedPage from '@/app/booking/page';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Book an appointment', description: 'Book a Chinese medicine or chiropractic appointment at Eden Clinic.' };

export default function EnglishBookingPage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  return <SharedPage searchParams={{ ...searchParams, lang: 'en' }} />;
}
