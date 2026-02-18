import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase";
import {
  getInstructiontableDefinition,
  instructiontableTableNames,
} from "@/lib/instructiontable-config";
import { isInstructiontableSessionActiveFromRequest } from "@/lib/instructiontable-auth";

const querySchema = z.object({
  table: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

const insertSchema = z.object({
  table: z.string().min(1),
  row: z.record(z.unknown()),
});

const updateSchema = z.object({
  table: z.string().min(1),
  pk: z.record(z.unknown()),
  updates: z.record(z.unknown()),
});

const deleteSchema = z.object({
  table: z.string().min(1),
  pk: z.record(z.unknown()),
});

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function isAllowedTable(table: string) {
  return instructiontableTableNames.includes(table);
}

function hasAllPrimaryKeys(
  definition: NonNullable<ReturnType<typeof getInstructiontableDefinition>>,
  pk: Record<string, unknown>
) {
  return definition.primaryKey.every((key) => key in pk);
}

export async function GET(request: NextRequest) {
  if (!isInstructiontableSessionActiveFromRequest(request)) {
    return unauthorized();
  }

  const parsed = querySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams)
  );
  if (!parsed.success) return badRequest("Invalid query parameters");

  const { table, limit, offset } = parsed.data;
  if (!isAllowedTable(table)) return badRequest("Table not allowed");

  try {
    const definition = getInstructiontableDefinition(table);
    if (!definition) return badRequest("Unknown table");

    const supabase = createServiceClient();
    const tableClient = (supabase as any).from(table);

    let query = tableClient.select("*", { count: "exact" });
    const firstPk = definition.primaryKey[0];
    if (firstPk) {
      query = query.order(firstPk, { ascending: true });
    }
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) {
      console.error("[instructiontable/rows:get] error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      table,
      primaryKey: definition.primaryKey,
      rows: data ?? [],
      count: count ?? null,
      limit,
      offset,
    });
  } catch (error) {
    console.error("[instructiontable/rows:get] exception:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!isInstructiontableSessionActiveFromRequest(request)) {
    return unauthorized();
  }

  try {
    const payload = await request.json();
    const parsed = insertSchema.safeParse(payload);
    if (!parsed.success) return badRequest("Invalid payload");

    const { table, row } = parsed.data;
    if (!isAllowedTable(table)) return badRequest("Table not allowed");

    const supabase = createServiceClient();
    const tableClient = (supabase as any).from(table);
    const { data, error } = await tableClient.insert(row).select("*").limit(1);

    if (error) {
      console.error("[instructiontable/rows:post] error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      row: data?.[0] ?? null,
    });
  } catch (error) {
    console.error("[instructiontable/rows:post] exception:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  if (!isInstructiontableSessionActiveFromRequest(request)) {
    return unauthorized();
  }

  try {
    const payload = await request.json();
    const parsed = updateSchema.safeParse(payload);
    if (!parsed.success) return badRequest("Invalid payload");

    const { table, pk, updates } = parsed.data;
    if (!isAllowedTable(table)) return badRequest("Table not allowed");

    const definition = getInstructiontableDefinition(table);
    if (!definition) return badRequest("Unknown table");
    if (!hasAllPrimaryKeys(definition, pk)) {
      return badRequest("Primary key fields are required");
    }

    const supabase = createServiceClient();
    let query: any = (supabase as any).from(table).update(updates).select("*").limit(1);
    for (const key of definition.primaryKey) {
      query = query.eq(key, pk[key]);
    }

    const { data, error } = await query;
    if (error) {
      console.error("[instructiontable/rows:patch] error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      row: data?.[0] ?? null,
    });
  } catch (error) {
    console.error("[instructiontable/rows:patch] exception:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!isInstructiontableSessionActiveFromRequest(request)) {
    return unauthorized();
  }

  try {
    const payload = await request.json();
    const parsed = deleteSchema.safeParse(payload);
    if (!parsed.success) return badRequest("Invalid payload");

    const { table, pk } = parsed.data;
    if (!isAllowedTable(table)) return badRequest("Table not allowed");

    const definition = getInstructiontableDefinition(table);
    if (!definition) return badRequest("Unknown table");
    if (!hasAllPrimaryKeys(definition, pk)) {
      return badRequest("Primary key fields are required");
    }

    const supabase = createServiceClient();
    let query: any = (supabase as any).from(table).delete().select("*").limit(1);
    for (const key of definition.primaryKey) {
      query = query.eq(key, pk[key]);
    }

    const { data, error } = await query;
    if (error) {
      console.error("[instructiontable/rows:delete] error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      row: data?.[0] ?? null,
    });
  } catch (error) {
    console.error("[instructiontable/rows:delete] exception:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

