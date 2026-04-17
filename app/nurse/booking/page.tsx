import { StaffAssistedBookingConsole } from "@/components/doctor/StaffAssistedBookingConsole";
import { getPublicBookableScheduleData } from "@/lib/bookable-schedule-data-server";

export const dynamic = "force-dynamic";

export default async function NurseBookingPage() {
  const doctors = await getPublicBookableScheduleData();

  return <StaffAssistedBookingConsole doctors={doctors} />;
}
