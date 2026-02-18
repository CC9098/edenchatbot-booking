import { NextRequest, NextResponse } from "next/server";
import { INSTRUCTIONTABLE_COOKIE_NAME } from "@/lib/instructiontable-auth";

export async function POST(_request: NextRequest) {
  const response = NextResponse.json({ success: true });
  response.cookies.set({
    name: INSTRUCTIONTABLE_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}

