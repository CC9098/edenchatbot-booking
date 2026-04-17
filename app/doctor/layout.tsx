"use client";

import type { ReactNode } from "react";

import { StaffConsoleShell } from "@/components/staff/StaffConsoleShell";

export default function DoctorLayout({ children }: { children: ReactNode }) {
  return <StaffConsoleShell workspace="doctor">{children}</StaffConsoleShell>;
}
