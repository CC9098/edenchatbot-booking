import { NextResponse } from "next/server";

import { AuthError, getCurrentUser, requireStaffRole } from "@/lib/auth-helpers";
import {
  DeepgramApiError,
  getDeepgramApiBaseUrl,
  getDeepgramDoctorVoiceLanguage,
  getDeepgramDoctorVoiceModel,
  getDeepgramErrorStatus,
  grantDeepgramTemporaryToken,
  isRetryableDeepgramError,
} from "@/lib/deepgram-stt";

export const dynamic = "force-dynamic";

function buildDeepgramFailureResponse(error: unknown) {
  const status = getDeepgramErrorStatus(error);

  if (status === 429) {
    return {
      status: 429,
      error: "即時語音轉錄服務繁忙，請稍後再試。",
    };
  }

  if (isRetryableDeepgramError(error)) {
    return {
      status: 503,
      error: "即時語音轉錄服務暫時不穩定，請稍後再試。",
    };
  }

  if (error instanceof DeepgramApiError) {
    return {
      status: 502,
      error: "即時語音轉錄服務回應異常，請稍後再試。",
    };
  }

  return null;
}

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requireStaffRole(user.id);

    const apiKey = process.env.DEEPGRAM_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "DEEPGRAM_API_KEY is not configured" }, { status: 500 });
    }

    const token = await grantDeepgramTemporaryToken({
      apiKey,
      ttlSeconds: 60,
    });

    return NextResponse.json({
      accessToken: token.accessToken,
      expiresIn: token.expiresIn,
      model: getDeepgramDoctorVoiceModel(),
      language: getDeepgramDoctorVoiceLanguage(),
      apiBaseUrl: getDeepgramApiBaseUrl(),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const deepgramFailureResponse = buildDeepgramFailureResponse(error);
    if (deepgramFailureResponse) {
      console.error("[POST /api/doctor/voice-notes/token] deepgram error:", error);
      return NextResponse.json(
        { error: deepgramFailureResponse.error },
        { status: deepgramFailureResponse.status }
      );
    }

    console.error("[POST /api/doctor/voice-notes/token] unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
