import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getMemberBookings } from "@/lib/member-bookings";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await getMemberBookings(user), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return NextResponse.json({ error: "暫時未能讀取預約，請稍後再試。" }, { status: 500 });
  }
}
