"use client";

import type { ReactNode } from "react";

import { StaffConsoleShell } from "@/components/staff/StaffConsoleShell";

export default function NurseLayout({ children }: { children: ReactNode }) {
  return <StaffConsoleShell workspace="nurse">{children}</StaffConsoleShell>;
}
