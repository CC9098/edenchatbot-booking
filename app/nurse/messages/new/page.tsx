import { NursePatientMessageClient } from "@/components/staff/NursePatientMessageClient";
import { CLINIC_BY_ID, PHYSICAL_CLINIC_IDS } from "@/shared/clinic-data";

export const dynamic = "force-dynamic";

export default function NurseNewPatientMessagePage() {
  const clinics = PHYSICAL_CLINIC_IDS.map((clinicId) => {
    const clinic = CLINIC_BY_ID[clinicId];

    return {
      id: clinic.id,
      nameZh: clinic.nameZh,
    };
  });

  return <NursePatientMessageClient clinics={clinics} />;
}
