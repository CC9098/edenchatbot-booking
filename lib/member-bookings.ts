import type { User } from "@supabase/supabase-js";
import { normalizePhoneForSearch, toHKE164 } from "@/lib/contact-utils";
import { createServiceClient } from "@/lib/supabase";

export type MemberBooking = {
  id: string;
  status: "pending" | "confirmed" | "cancelled" | "failed";
  appointment_date: string;
  appointment_time: string;
  doctor_name_zh: string;
  clinic_name_zh: string;
  patient_name: string;
};

const FIELDS = "id,status,appointment_date,appointment_time,doctor_name_zh,clinic_name_zh,patient_name";

export function getVerifiedMemberPhoneVariants(user: Pick<User, "phone" | "phone_confirmed_at">): string[] {
  if (!user.phone_confirmed_at || !user.phone) return [];
  const digits = normalizePhoneForSearch(toHKE164(user.phone));
  if (!digits) return [];
  return digits.startsWith("852") && digits.length === 11
    ? [digits, digits.slice(3)]
    : [digits];
}

export function splitMemberBookings(bookings: MemberBooking[], now = new Date()) {
  const hkNow = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Hong_Kong", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(now).replace(" ", "T");
  const time = (booking: MemberBooking) => `${booking.appointment_date}T${booking.appointment_time.slice(0, 5)}`;
  const upcoming = bookings.filter((booking) =>
    (booking.status === "confirmed" || booking.status === "pending") && time(booking) >= hkNow,
  ).sort((a, b) => time(a).localeCompare(time(b)));
  const upcomingIds = new Set(upcoming.map((booking) => booking.id));
  const history = bookings.filter((booking) => !upcomingIds.has(booking.id))
    .sort((a, b) => time(b).localeCompare(time(a)));
  return { upcoming, history };
}

/** Call only with a user obtained from Supabase Auth getUser, never profile input. */
export async function getMemberBookings(user: User) {
  const client = createServiceClient();
  const ownQuery = client.from("booking_intake").select(FIELDS)
    .eq("user_id", user.id).order("appointment_date", { ascending: false }).limit(100);
  const phoneVariants = getVerifiedMemberPhoneVariants(user);
  const [own, byPhone] = await Promise.all([
    ownQuery,
    phoneVariants.length
      ? client.from("booking_intake").select(FIELDS).in("phone_digits", phoneVariants)
        .order("appointment_date", { ascending: false }).limit(100)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (own.error || byPhone.error) throw new Error("暫時未能讀取預約，請稍後再試。");
  const rows = [...(own.data || []), ...(byPhone.data || [])] as MemberBooking[];
  const unique = [...new Map(rows.map((booking) => [booking.id, booking])).values()];
  return {
    ...splitMemberBookings(unique),
    hasVerifiedPhone: phoneVariants.length > 0,
    limited: (own.data?.length || 0) === 100 || (byPhone.data?.length || 0) === 100,
  };
}
