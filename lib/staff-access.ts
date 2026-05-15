import type { StaffRoleName } from "@/lib/auth-helpers";

export type StaffKind = "core_assistant" | "part_time_assistant" | "doctor" | "admin";

export type StaffAccessPreset = "core_assistant" | "part_time_assistant" | "doctor" | "admin";

export type StaffAccessPresetConfig = {
  preset: StaffAccessPreset;
  label: string;
  role: StaffRoleName;
  staffKind: StaffKind;
};

export const STAFF_ACCESS_PRESETS: Record<StaffAccessPreset, StaffAccessPresetConfig> = {
  core_assistant: {
    preset: "core_assistant",
    label: "主力姑娘",
    role: "assistant",
    staffKind: "core_assistant",
  },
  part_time_assistant: {
    preset: "part_time_assistant",
    label: "兼職姑娘",
    role: "assistant",
    staffKind: "part_time_assistant",
  },
  doctor: {
    preset: "doctor",
    label: "醫師",
    role: "doctor",
    staffKind: "doctor",
  },
  admin: {
    preset: "admin",
    label: "管理員",
    role: "admin",
    staffKind: "admin",
  },
};

export const STAFF_ACCESS_PRESET_OPTIONS = Object.values(STAFF_ACCESS_PRESETS);

export function normalizeStaffEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isStaffAccessPreset(value: string): value is StaffAccessPreset {
  return Object.prototype.hasOwnProperty.call(STAFF_ACCESS_PRESETS, value);
}

export function getStaffAccessPreset(preset: StaffAccessPreset): StaffAccessPresetConfig {
  return STAFF_ACCESS_PRESETS[preset];
}

export function getDefaultStaffKind(role: StaffRoleName): StaffKind {
  if (role === "assistant") return "core_assistant";
  return role;
}

export function getStaffKindLabel(staffKind: string | null | undefined, role?: string | null): string {
  if (staffKind === "part_time_assistant") return "兼職姑娘";
  if (staffKind === "core_assistant") return "主力姑娘";
  if (staffKind === "admin" || role === "admin") return "管理員";
  if (staffKind === "doctor" || role === "doctor") return "醫師";
  if (role === "assistant") return "主力姑娘";
  return "Staff";
}
