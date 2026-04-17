import { Fira_Code, Fira_Sans } from "next/font/google";

import { StaffOperationsConsole } from "@/components/doctor/StaffOperationsConsole";

const firaSans = Fira_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const firaCode = Fira_Code({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const dynamic = "force-dynamic";

export default function NurseOperationsPage() {
  return (
    <StaffOperationsConsole
      sansClassName={firaSans.className}
      monoClassName={firaCode.className}
    />
  );
}
