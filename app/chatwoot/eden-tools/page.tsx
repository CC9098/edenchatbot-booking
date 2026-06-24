import { ChatwootDashboardEdenToolsClient } from "@/components/staff/ChatwootDashboardEdenToolsClient";
import { CLINIC_BY_ID, PHYSICAL_CLINIC_IDS } from "@/shared/clinic-data";

export const dynamic = "force-dynamic";

export default function ChatwootDashboardEdenToolsPage() {
  const clinics = PHYSICAL_CLINIC_IDS.map((clinicId) => {
    const clinic = CLINIC_BY_ID[clinicId];

    return {
      id: clinic.id,
      nameZh: clinic.nameZh,
    };
  });

  return <ChatwootDashboardEdenToolsClient clinics={clinics} />;
}
