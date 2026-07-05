import { redirect } from "next/navigation";

function firstParam(value: string | string[] | undefined): string | null {
  const normalized = Array.isArray(value) ? value[0] : value;
  return normalized?.trim() || null;
}

export default function LegacyCancelPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const params = new URLSearchParams({ action: "cancel" });
  const token = firstParam(searchParams?.token);
  if (token) {
    params.set("token", token);
  }

  redirect(`/manage-booking?${params.toString()}`);
}
