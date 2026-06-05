import { NextResponse } from "next/server";

import {
  downloadWhatsappTemplateMedia,
  WhatsappTemplateMediaError,
} from "@/lib/whatsapp-template-media";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: { token: string } },
) {
  try {
    const media = await downloadWhatsappTemplateMedia(params.token);

    return new NextResponse(media.body, {
      headers: {
        "Content-Type": media.contentType,
        "Cache-Control": "no-store, max-age=0",
        "X-Robots-Tag": "noindex, nofollow",
        "X-Expires-At": media.expiresAt.toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof WhatsappTemplateMediaError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("[GET /api/whatsapp-media/[token]] unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
