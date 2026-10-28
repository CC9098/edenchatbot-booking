import type { Metadata } from 'next';
import SharedPage from '@/app/manage-booking/page';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Manage appointments', description: 'Reschedule or cancel your Eden Clinic appointment using a WhatsApp sign-in link.' };

export default function EnglishBookingPage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  return <SharedPage searchParams={{ ...searchParams, lang: 'en' }} />;
}
