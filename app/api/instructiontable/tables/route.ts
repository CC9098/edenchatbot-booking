import { NextRequest, NextResponse } from "next/server";
import { instructiontableDefinitions } from "@/lib/instructiontable-config";
import { isInstructiontableSessionActiveFromRequest } from "@/lib/instructiontable-auth";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function GET(request: NextRequest) {
  if (!isInstructiontableSessionActiveFromRequest(request)) {
    return unauthorized();
  }

  return NextResponse.json({
    success: true,
    tables: instructiontableDefinitions,
  });
}

