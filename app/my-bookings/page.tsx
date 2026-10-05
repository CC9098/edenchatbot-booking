import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getMemberBookings, type MemberBooking } from "@/lib/member-bookings";
import { MemberSignOutButton } from "@/components/member/MemberSignOutButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "我的預約 | 醫天圓" };

const STATUS = { pending: "處理中", confirmed: "已確認", cancelled: "已取消", failed: "未完成" };

function BookingCards({ bookings, empty }: { bookings: MemberBooking[]; empty: string }) {
  if (!bookings.length) return <p className="rounded-2xl bg-white p-5 text-sm text-slate-500">{empty}</p>;
  return <div className="grid gap-3 sm:grid-cols-2">{bookings.map((booking) => (
    <article key={booking.id} className="patient-card space-y-3 p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold text-slate-900">{booking.doctor_name_zh}</h3>
        <span className="rounded-full bg-primary-light px-3 py-1 text-xs text-primary">{STATUS[booking.status]}</span>
      </div>
      <p className="text-lg font-semibold text-primary">{booking.appointment_date}　{booking.appointment_time.slice(0, 5)}</p>
      <p className="text-sm text-slate-600">{booking.clinic_name_zh} · {booking.patient_name}</p>
    </article>
  ))}</div>;
}

export default async function MyBookingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=%2Fmy-bookings");
  let bookings;
  try {
    bookings = await getMemberBookings(user);
  } catch {
    return <main className="patient-pane"><div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-semibold text-primary">我的預約</h1>
      <p>暫時未能讀取預約，請稍後再試。</p>
      <Link href="/my-bookings" className="text-primary underline">重新載入</Link>
    </div></main>;
  }
  return <main className="patient-pane"><div className="mx-auto max-w-3xl space-y-6">
    <div className="flex items-center justify-between gap-3">
      <h1 className="text-2xl font-semibold text-primary">我的預約</h1>
      <MemberSignOutButton />
    </div>
    <div className="flex flex-wrap gap-3">
      <Link href="/booking" className="inline-flex min-h-11 items-center rounded-xl bg-primary px-4 py-2 text-sm text-white">新增預約</Link>
      <Link href="/manage-booking" className="inline-flex min-h-11 items-center rounded-xl border border-primary/20 px-4 py-2 text-sm text-primary">更改或取消預約</Link>
      <Link href="/chat" className="inline-flex min-h-11 items-center px-3 py-2 text-sm text-primary">返回諮詢</Link>
    </div>
    {!bookings.hasVerifiedPhone && <p className="rounded-xl bg-primary-light p-4 text-sm text-slate-600">
      以前用 WhatsApp 預約的紀錄，可透過「更改或取消預約」驗證預約電話後查看。
    </p>}
    <section className="space-y-3"><h2 className="text-lg font-semibold text-slate-900">即將到來</h2>
      <BookingCards bookings={bookings.upcoming} empty="暫時沒有即將到來的預約。" />
    </section>
    <section className="space-y-3"><h2 className="text-lg font-semibold text-slate-900">過往及已取消預約</h2>
      <BookingCards bookings={bookings.history} empty="暫時沒有過往預約紀錄。" />
    </section>
    {bookings.limited && <p className="text-sm text-slate-500">如需更早的預約紀錄，請聯絡診所。</p>}
    <p className="text-xs text-slate-500">預約時間以香港時間顯示。</p>
  </div></main>;
}
