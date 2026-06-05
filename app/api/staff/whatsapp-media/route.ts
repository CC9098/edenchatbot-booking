import { NextRequest, NextResponse } from "next/server";

import { AuthError, getCurrentUser, requireStaffRole } from "@/lib/auth-helpers";
import {
  WhatsappTemplateMediaError,
  uploadWhatsappTemplateMedia,
} from "@/lib/whatsapp-template-media";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requireStaffRole(user.id);

    const formData = await request.formData();
    const file = formData.get("file");
    const expiresInSeconds = formData.get("expiresInSeconds");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "請選擇圖片。" }, { status: 400 });
    }

    const result = await uploadWhatsappTemplateMedia({
      file,
      expiresInSeconds,
      requestUrl: request.url,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError || error instanceof WhatsappTemplateMediaError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("[POST /api/staff/whatsapp-media] unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
