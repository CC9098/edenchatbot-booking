"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getInstructiontable5W1H,
  type InstructiontableDefinition,
} from "@/lib/instructiontable-config";

type RowRecord = Record<string, unknown>;

type TablesResponse = {
  success: boolean;
  tables: InstructiontableDefinition[];
};

type RowsResponse = {
  success: boolean;
  table: string;
  primaryKey: string[];
  rows: RowRecord[];
  count: number | null;
  limit: number;
  offset: number;
};

type EditorMode = "create" | "update";

const GROUP_LABELS: Record<InstructiontableDefinition["group"], string> = {
  content: "Content",
  chat: "Chat",
  care: "Care",
  booking: "Booking",
  billing: "Billing",
  media: "Media",
};

const FIVE_W_ONE_H_LABELS: Array<{
  key: "why" | "what" | "how" | "where" | "when" | "who";
  label: string;
}> = [
  { key: "why", label: "Why" },
  { key: "what", label: "What" },
  { key: "how", label: "How" },
  { key: "where", label: "Where" },
  { key: "when", label: "When" },
  { key: "who", label: "Who" },
];

function shortValue(value: unknown) {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    const json = JSON.stringify(value);
    return json.length > 100 ? `${json.slice(0, 100)}...` : json;
  } catch {
    return String(value);
  }
}

function toStableJson(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function InstructionTableApp({
  initialAuthenticated,
}: {
  initialAuthenticated: boolean;
}) {
  const [authenticated, setAuthenticated] = useState(initialAuthenticated);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  const [tables, setTables] = useState<InstructiontableDefinition[]>([]);
  const [tablesError, setTablesError] = useState<string | null>(null);
  const [loadingTables, setLoadingTables] = useState(false);
  const [tableQuery, setTableQuery] = useState("");
  const [selectedTable, setSelectedTable] = useState<string>("");

  const [rows, setRows] = useState<RowRecord[]>([]);
  const [rowCount, setRowCount] = useState<number | null>(null);
  const [rowsError, setRowsError] = useState<string | null>(null);
  const [loadingRows, setLoadingRows] = useState(false);
  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<EditorMode>("create");
  const [editorText, setEditorText] = useState("{}");
  const [editorError, setEditorError] = useState<string | null>(null);
  const [editingRow, setEditingRow] = useState<RowRecord | null>(null);
  const [savingEditor, setSavingEditor] = useState(false);
  const [deletingPk, setDeletingPk] = useState<string | null>(null);

  const selectedDefinition = useMemo(
    () => tables.find((table) => table.name === selectedTable) ?? null,
    [tables, selectedTable]
  );

  const filteredTables = useMemo(() => {
    const query = tableQuery.trim().toLowerCase();
    if (!query) return tables;
    return tables.filter(
      (table) =>
        table.name.toLowerCase().includes(query) ||
        table.label.toLowerCase().includes(query) ||
        table.description.toLowerCase().includes(query)
    );
  }, [tables, tableQuery]);

  const outboundRelations = selectedDefinition?.relations ?? [];
  const inboundRelations = useMemo(() => {
    if (!selectedDefinition) return [] as Array<{
      sourceTable: string;
      sourceLabel: string;
      column: string;
      targetColumn: string;
    }>;

    const items: Array<{
      sourceTable: string;
      sourceLabel: string;
      column: string;
      targetColumn: string;
    }> = [];

    for (const table of tables) {
      for (const relation of table.relations) {
        if (relation.targetTable === selectedDefinition.name) {
          items.push({
            sourceTable: table.name,
            sourceLabel: table.label,
            column: relation.column,
            targetColumn: relation.targetColumn,
          });
        }
      }
    }
    return items;
  }, [selectedDefinition, tables]);

  const columns = useMemo(() => {
    if (!rows.length) return selectedDefinition?.primaryKey ?? [];
    const set = new Set<string>();
    for (const row of rows) {
      Object.keys(row).forEach((key) => set.add(key));
    }

    const ordered: string[] = [];
    for (const key of selectedDefinition?.primaryKey ?? []) {
      if (set.has(key)) {
        ordered.push(key);
        set.delete(key);
      }
    }
    const remaining = [...set].sort((a, b) => a.localeCompare(b));
    return [...ordered, ...remaining];
  }, [rows, selectedDefinition]);

  const selected5W1H = useMemo(() => {
    if (!selectedDefinition) return null;
    return getInstructiontable5W1H(selectedDefinition.name);
  }, [selectedDefinition]);

  const loadTables = useCallback(async () => {
    try {
      setLoadingTables(true);
      setTablesError(null);
      const response = await fetch("/api/instructiontable/tables", {
        method: "GET",
        cache: "no-store",
      });
      if (response.status === 401) {
        setAuthenticated(false);
        return;
      }
      const payload = (await response.json()) as TablesResponse & { error?: string };
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Failed to load tables");
      }

      setTables(payload.tables);
      if (!selectedTable && payload.tables.length > 0) {
        setSelectedTable(payload.tables[0].name);
      }
    } catch (error) {
      setTablesError(error instanceof Error ? error.message : "Failed to load tables");
    } finally {
      setLoadingTables(false);
    }
  }, [selectedTable]);

  const loadRows = useCallback(
    async (tableName: string, currentLimit: number, currentOffset: number) => {
      try {
        setLoadingRows(true);
        setRowsError(null);
        const params = new URLSearchParams({
          table: tableName,
          limit: String(currentLimit),
          offset: String(currentOffset),
        });
        const response = await fetch(`/api/instructiontable/rows?${params.toString()}`, {
          method: "GET",
          cache: "no-store",
        });
        if (response.status === 401) {
          setAuthenticated(false);
          return;
        }
        const payload = (await response.json()) as RowsResponse & { error?: string };
        if (!response.ok || !payload.success) {
          throw new Error(payload.error || "Failed to load rows");
        }
        setRows(payload.rows);
        setRowCount(payload.count);
      } catch (error) {
        setRowsError(error instanceof Error ? error.message : "Failed to load rows");
        setRows([]);
        setRowCount(null);
      } finally {
        setLoadingRows(false);
      }
    },
    []
  );

  useEffect(() => {
    if (authenticated) {
      void loadTables();
    }
  }, [authenticated, loadTables]);

  useEffect(() => {
    if (authenticated && selectedTable) {
      void loadRows(selectedTable, limit, offset);
    }
  }, [authenticated, selectedTable, limit, offset, loadRows]);

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    setLoggingIn(true);
    setLoginError(null);
    try {
      const response = await fetch("/api/instructiontable/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const payload = (await response.json()) as { success?: boolean; error?: string };
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Login failed");
      }
      setPassword("");
      setAuthenticated(true);
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "Login failed");
    } finally {
      setLoggingIn(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/instructiontable/logout", { method: "POST" });
    setAuthenticated(false);
    setTables([]);
    setRows([]);
    setSelectedTable("");
  }

  function openCreateEditor() {
    setEditorMode("create");
    setEditingRow(null);
    setEditorText("{\n  \n}");
    setEditorError(null);
    setEditorOpen(true);
  }

  function openEditEditor(row: RowRecord) {
    setEditorMode("update");
    setEditingRow(row);
    setEditorText(JSON.stringify(row, null, 2));
    setEditorError(null);
    setEditorOpen(true);
  }

  function buildPkObject(row: RowRecord) {
    const keys = selectedDefinition?.primaryKey ?? [];
    const result: Record<string, unknown> = {};
    for (const key of keys) {
      result[key] = row[key];
    }
    return result;
  }

  async function saveEditor() {
    if (!selectedDefinition) return;

    setSavingEditor(true);
    setEditorError(null);

    try {
      const parsed = JSON.parse(editorText) as RowRecord;
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        throw new Error("JSON must be an object");
      }

      if (editorMode === "create") {
        const response = await fetch("/api/instructiontable/rows", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            table: selectedDefinition.name,
            row: parsed,
          }),
        });
        const payload = (await response.json()) as { success?: boolean; error?: string };
        if (!response.ok || !payload.success) {
          throw new Error(payload.error || "Insert failed");
        }
      } else {
        if (!editingRow) {
          throw new Error("Missing editing row");
        }

        const pk = buildPkObject(editingRow);
        const updates: Record<string, unknown> = {};
        const pkSet = new Set(selectedDefinition.primaryKey);

        for (const [key, value] of Object.entries(parsed)) {
          if (pkSet.has(key)) continue;
          const originalValue = editingRow[key];
          if (toStableJson(value) !== toStableJson(originalValue)) {
            updates[key] = value;
          }
        }

        if (Object.keys(updates).length === 0) {
          throw new Error("No changed fields to update");
        }

        const response = await fetch("/api/instructiontable/rows", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            table: selectedDefinition.name,
            pk,
            updates,
          }),
        });
        const payload = (await response.json()) as { success?: boolean; error?: string };
        if (!response.ok || !payload.success) {
          throw new Error(payload.error || "Update failed");
        }
      }

      setEditorOpen(false);
      await loadRows(selectedDefinition.name, limit, offset);
    } catch (error) {
      setEditorError(error instanceof Error ? error.message : "Save failed");
    } finally {
      setSavingEditor(false);
    }
  }

  async function deleteRow(row: RowRecord) {
    if (!selectedDefinition) return;

    const pk = buildPkObject(row);
    const pkText = JSON.stringify(pk);
    const ok = window.confirm(`Delete row ${pkText}? This cannot be undone.`);
    if (!ok) return;

    setDeletingPk(pkText);
    try {
      const response = await fetch("/api/instructiontable/rows", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          table: selectedDefinition.name,
          pk,
        }),
      });
      const payload = (await response.json()) as { success?: boolean; error?: string };
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Delete failed");
      }
      await loadRows(selectedDefinition.name, limit, offset);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Delete failed");
    } finally {
      setDeletingPk(null);
    }
  }

  if (!authenticated) {
    return (
      <main className="min-h-screen bg-slate-100 px-4 py-10">
        <div className="mx-auto max-w-md rounded-2xl bg-white p-6 shadow-xl ring-1 ring-slate-200">
          <h1 className="text-2xl font-semibold text-slate-900">Instruction Table</h1>
          <p className="mt-2 text-sm text-slate-600">
            Enter password to access Supabase table manager.
          </p>
          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-emerald-300 focus:ring-2"
              placeholder="Password"
              autoComplete="current-password"
              required
            />
            {loginError ? <p className="text-sm text-red-600">{loginError}</p> : null}
            <button
              type="submit"
              disabled={loggingIn}
              className="w-full rounded-lg bg-emerald-700 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              {loggingIn ? "Checking..." : "Unlock"}
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-[1600px] px-4 py-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Instruction Table</h1>
            <p className="text-sm text-slate-600">
              View and edit Supabase `public` tables directly.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                void loadTables();
                if (selectedTable) void loadRows(selectedTable, limit, offset);
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-700"
            >
              Logout
            </button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <input
              value={tableQuery}
              onChange={(event) => setTableQuery(event.target.value)}
              placeholder="Search table..."
              className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-emerald-300 focus:ring-2"
            />
            {tablesError ? (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{tablesError}</p>
            ) : null}
            {loadingTables ? <p className="text-sm text-slate-500">Loading tables...</p> : null}
            <div className="max-h-[70vh] space-y-4 overflow-auto pr-1">
              {(Object.keys(GROUP_LABELS) as Array<InstructiontableDefinition["group"]>).map(
                (group) => {
                  const groupTables = filteredTables.filter((table) => table.group === group);
                  if (groupTables.length === 0) return null;
                  return (
                    <div key={group}>
                      <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {GROUP_LABELS[group]}
                      </h2>
                      <div className="space-y-1">
                        {groupTables.map((table) => {
                          const isSelected = table.name === selectedTable;
                          return (
                            <button
                              key={table.name}
                              type="button"
                              onClick={() => {
                                setSelectedTable(table.name);
                                setOffset(0);
                              }}
                              className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                                isSelected
                                  ? "bg-emerald-600 text-white"
                                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                              }`}
                            >
                              <div className="font-medium">{table.label}</div>
                              <div
                                className={`mt-0.5 text-xs ${isSelected ? "text-emerald-50" : "text-slate-500"}`}
                              >
                                {table.name}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          </section>

          <section className="space-y-4">
            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">
                    {selectedDefinition?.label ?? "Select a table"}
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    {selectedDefinition?.description ?? "Pick a table from the left panel."}
                  </p>
                  {selectedDefinition ? (
                    <p className="mt-2 text-xs text-slate-500">
                      PK: {selectedDefinition.primaryKey.join(", ")}
                    </p>
                  ) : null}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={openCreateEditor}
                    disabled={!selectedDefinition}
                    className="rounded-lg bg-emerald-700 px-3 py-2 text-sm text-white hover:bg-emerald-800 disabled:opacity-50"
                  >
                    Add Row
                  </button>
                </div>
              </div>

              {selectedDefinition ? (
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-lg border border-slate-200 p-3">
                    <h3 className="text-sm font-semibold text-slate-700">Outbound Relations</h3>
                    {outboundRelations.length === 0 ? (
                      <p className="mt-2 text-xs text-slate-500">No outbound FK relations.</p>
                    ) : (
                      <div className="mt-2 space-y-2">
                        {outboundRelations.map((relation) => (
                          <button
                            type="button"
                            key={`${relation.column}-${relation.targetTable}-${relation.targetColumn}`}
                            onClick={() => {
                              if (tables.some((table) => table.name === relation.targetTable)) {
                                setSelectedTable(relation.targetTable);
                                setOffset(0);
                              }
                            }}
                            className="w-full rounded-md bg-slate-100 px-2 py-1 text-left text-xs text-slate-700 hover:bg-slate-200"
                          >
                            {relation.column} → {relation.targetTable}.{relation.targetColumn}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="rounded-lg border border-slate-200 p-3">
                    <h3 className="text-sm font-semibold text-slate-700">Inbound Relations</h3>
                    {inboundRelations.length === 0 ? (
                      <p className="mt-2 text-xs text-slate-500">No inbound FK relations.</p>
                    ) : (
                      <div className="mt-2 space-y-2">
                        {inboundRelations.map((relation) => (
                          <button
                            type="button"
                            key={`${relation.sourceTable}-${relation.column}-${relation.targetColumn}`}
                            onClick={() => {
                              setSelectedTable(relation.sourceTable);
                              setOffset(0);
                            }}
                            className="w-full rounded-md bg-slate-100 px-2 py-1 text-left text-xs text-slate-700 hover:bg-slate-200"
                          >
                            {relation.sourceTable}.{relation.column} → {selectedDefinition.name}.
                            {relation.targetColumn}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

              {selected5W1H ? (
                <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-emerald-900">
                      5W1H Integrated Guide
                    </h3>
                    <span className="rounded-md bg-emerald-700 px-2 py-0.5 text-[11px] font-medium text-white">
                      For {selectedDefinition?.name}
                    </span>
                  </div>
                  <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                    {FIVE_W_ONE_H_LABELS.map(({ key, label }) => (
                      <div key={key} className="rounded-lg border border-emerald-200 bg-white p-2">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                          {label}
                        </div>
                        <p className="mt-1 text-xs leading-5 text-slate-700">
                          {selected5W1H[key]}
                        </p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    Deep doc reference:{" "}
                    <code>/docs/SUPABASE_TABLES_5W1H.md</code>
                  </p>
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm text-slate-600">
                  {rowCount === null ? "Rows: -" : `Rows: ${rowCount}`}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <label htmlFor="limit" className="text-slate-600">
                    Limit
                  </label>
                  <select
                    id="limit"
                    value={limit}
                    onChange={(event) => {
                      setLimit(Number(event.target.value));
                      setOffset(0);
                    }}
                    className="rounded border border-slate-300 px-2 py-1 text-sm"
                  >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={200}>200</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => setOffset((prev) => Math.max(0, prev - limit))}
                    disabled={offset <= 0}
                    className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50"
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    onClick={() => setOffset((prev) => prev + limit)}
                    disabled={rowCount !== null && offset + limit >= rowCount}
                    className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>

              {rowsError ? (
                <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{rowsError}</p>
              ) : null}
              {loadingRows ? <p className="text-sm text-slate-500">Loading rows...</p> : null}

              <div className="overflow-auto rounded-xl border border-slate-200">
                <table className="min-w-full border-collapse text-xs">
                  <thead className="bg-slate-100">
                    <tr>
                      {columns.map((column) => (
                        <th
                          key={column}
                          className="whitespace-nowrap border-b border-slate-200 px-2 py-2 text-left font-semibold text-slate-700"
                        >
                          {column}
                        </th>
                      ))}
                      <th className="whitespace-nowrap border-b border-slate-200 px-2 py-2 text-left font-semibold text-slate-700">
                        actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 && !loadingRows ? (
                      <tr>
                        <td
                          colSpan={Math.max(columns.length + 1, 2)}
                          className="px-2 py-6 text-center text-sm text-slate-500"
                        >
                          No rows
                        </td>
                      </tr>
                    ) : null}
                    {rows.map((row, idx) => {
                      const pkText = JSON.stringify(buildPkObject(row));
                      return (
                        <tr key={`${pkText}-${idx}`} className="border-b border-slate-100">
                          {columns.map((column) => (
                            <td
                              key={column}
                              className="max-w-[280px] whitespace-pre-wrap px-2 py-2 align-top text-slate-700"
                              title={shortValue(row[column])}
                            >
                              {shortValue(row[column])}
                            </td>
                          ))}
                          <td className="whitespace-nowrap px-2 py-2 align-top">
                            <div className="flex gap-1">
                              <button
                                type="button"
                                onClick={() => openEditEditor(row)}
                                className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  void deleteRow(row);
                                }}
                                disabled={deletingPk === pkText}
                                className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
                              >
                                {deletingPk === pkText ? "Deleting..." : "Delete"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      </div>

      {editorOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-3xl rounded-2xl bg-white p-4 shadow-2xl ring-1 ring-slate-200">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">
                {editorMode === "create" ? "Create row" : "Edit row"}
              </h3>
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
              >
                Close
              </button>
            </div>
            <p className="mb-2 text-xs text-slate-500">
              JSON object only. For update, primary key fields are used for matching and not updated.
            </p>
            <textarea
              value={editorText}
              onChange={(event) => setEditorText(event.target.value)}
              className="h-80 w-full rounded-lg border border-slate-300 p-3 font-mono text-xs outline-none ring-emerald-300 focus:ring-2"
              spellCheck={false}
            />
            {editorError ? <p className="mt-2 text-sm text-red-700">{editorError}</p> : null}
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  void saveEditor();
                }}
                disabled={savingEditor}
                className="rounded-lg bg-emerald-700 px-3 py-2 text-sm text-white hover:bg-emerald-800 disabled:opacity-50"
              >
                {savingEditor ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
