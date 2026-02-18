import type { Metadata } from "next";
import { InstructionTableApp } from "@/components/instructiontable/InstructionTableApp";
import { isInstructiontableSessionActiveFromCookies } from "@/lib/instructiontable-auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Instruction Table",
  description: "Password protected Supabase table manager",
  robots: {
    index: false,
    follow: false,
  },
};

export default function InstructionTablePage() {
  const initialAuthenticated = isInstructiontableSessionActiveFromCookies();
  return <InstructionTableApp initialAuthenticated={initialAuthenticated} />;
}

