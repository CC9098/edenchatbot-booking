import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { verifyLoginOtp } from "@/lib/phone-login";

export const runtime = "nodejs";

const schema = z.object({
  phone: z.string().trim().min(6, "請輸入 WhatsApp 電話號碼"),
  code: z.string().trim().min(4, "請輸入驗證碼"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "資料格式不正確", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const pendingCookies: Array<{
      name: string;
      value: string;
      options: Record<string, unknown>;
    }> = [];

    const result = await verifyLoginOtp({
      ...parsed.data,
      setCookie: (name, value, options) => {
        pendingCookies.push({ name, value, options });
      },
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const response = NextResponse.json(result);

    for (const { name, value, options } of pendingCookies) {
      response.cookies.set(
        name,
        value,
        options as Parameters<typeof response.cookies.set>[2],
      );
    }

    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "驗證時發生錯誤。" },
      { status: 500 },
    );
  }
}
