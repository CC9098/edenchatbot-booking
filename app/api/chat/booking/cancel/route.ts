import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { deleteEvent } from "@/lib/google-calendar";
import { getCurrentUser } from "@/lib/auth-helpers";

// ── Whitelist schema ────────────────────────────────────────────────
const bridgeCancelSchema = z
  .object({
    eventId: z.string(),
    calendarId: z.string(),
  })
  .strict();

export async function POST(request: NextRequest) {
  try {
    // Optional auth
    const user = await getCurrentUser().catch(() => null);
    if (user) {
      console.log(`[chat/booking/cancel] authed user: ${user.id}`);
    }

    const body = await request.json();
    const parsed = bridgeCancelSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.errors },
        { status: 400 }
      );
    }

    const { eventId, calendarId } = parsed.data;

    const result = await deleteEvent(calendarId, eventId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to cancel booking" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("[chat/booking/cancel] Error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
