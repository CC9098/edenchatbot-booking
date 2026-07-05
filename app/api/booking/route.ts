// 已退役 2026-07，全面改用 /api/booking-whatsapp 及 /api/widget-booking/*，保留至 2026-09 後可刪。
import { NextResponse } from "next/server";

const RETIRED_BOOKING_MESSAGE =
  "此服務已更新，請經 /manage-booking 管理預約";

function retiredBookingResponse() {
  return NextResponse.json(
    { error: RETIRED_BOOKING_MESSAGE },
    { status: 410 },
  );
}

export async function POST() {
  return retiredBookingResponse();
}

export async function GET() {
  return retiredBookingResponse();
}

export async function DELETE() {
  return retiredBookingResponse();
}

export async function PATCH() {
  return retiredBookingResponse();
}
