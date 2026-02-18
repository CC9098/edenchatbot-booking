import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  createInstructiontableSessionToken,
  getInstructiontableSessionMaxAgeSeconds,
  INSTRUCTIONTABLE_COOKIE_NAME,
  verifyInstructiontablePassword,
} from "@/lib/instructiontable-auth";

const loginSchema = z.object({
  password: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    if (!verifyInstructiontablePassword(parsed.data.password)) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }

    const response = NextResponse.json({ success: true });
    response.cookies.set({
      name: INSTRUCTIONTABLE_COOKIE_NAME,
      value: createInstructiontableSessionToken(),
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: getInstructiontableSessionMaxAgeSeconds(),
    });
    return response;
  } catch (error) {
    console.error("[instructiontable/login] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

