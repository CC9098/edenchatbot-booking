import { redirect } from "next/navigation";

export default function LegacyDoctorBookingPage() {
  redirect("/nurse/booking");
}
